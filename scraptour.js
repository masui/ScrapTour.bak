//
// 現在地の近所のPOIをリストする
// 位置データはFirebase functionで取得
//

var curpos = {}

var locations = [] // POIリスト
    
var map // GoogleMapsオブジェクト


var selectedimage = 'https://i.gyazo.com/a9dd5417ae63c06ccddc2040adbd04af.png' // 空白画像

$(function(){
    var project = 'masuimap'
    
    // URL引数の解析
    // ?loc=abc みたいなものを解析
    let args = {}
    document.location.search.substring(1).split('&').forEach((s) => {
        if(s != ''){
	    if(s.match(/=/)){
		let [name, value] = s.split('=')
		args[name] = decodeURIComponent(value)
	    }
	    else {
		project = s
	    }
        }
    })
    if(args['loc']){ // 引数で位置を指定された場合
	// ?loc=N35.9912193E138.1319693Z16
	var match = args['loc'].match(/[NS]([\d\.]*),?[EW]([\d\.]*),?Z(.*)/)
	if(match){
	    curpos.latitude = Number(match[1])
	    curpos.longitude = Number(match[2])
	    curpos.zoom = Number(match[3])
	    initGoogleMaps(curpos.latitude,curpos.longitude,curpos.zoom)
	    //showlists()
	}
    }
    else {
	// geoAPIで現在地を取得
	navigator.geolocation.getCurrentPosition(googleMapsSuccess, googleMapsError);
	// showlist() はコールバックの中で呼ばれる
	// await は使えないのだろうか?
    }

    // sbProjectプロジェクトからデータ取得
    console.log(JSON.stringify(getlist(project)))
})

function googleMapsSuccess(position) {
    mapsurl = "https://maps.google.com/maps?q=" +
        position.coords.latitude + "," +
        position.coords.longitude;
    curpos.latitude = position.coords.latitude
    curpos.longitude = position.coords.longitude
    curpos.zoom = 16
    initGoogleMaps(curpos.latitude,curpos.longitude,curpos.zoom)
    //showlists()
}

function googleMapsError(error) {
    var err_msg = "";
    switch(error.code)
    {
        case 1:
        err_msg = "位置情報の利用が許可されていません";
        break;
        case 2:
        err_msg = "デバイスの位置が判定できません";
        break;
        case 3:
        err_msg = "タイムアウトしました";
        break;
    }
    alert(err_msg)
    //document.getElementById("show_result").innerHTML = err_msg;
}


function distance(lat1, lng1, lat2, lng2) {
    const R = Math.PI / 180
    lat1 *= R
    lng1 *= R
    lat2 *= R
    lng2 *= R
    return 6371 * Math.acos(Math.cos(lat1) * Math.cos(lat2) * Math.cos(lng2 - lng1) + Math.sin(lat1) * Math.sin(lat2))
}

function locSearchAndDisplay(){
    $('#image').attr('src',"https://i.gyazo.com/a9dd5417ae63c06ccddc2040adbd04af.png") // 空白
    var center = map.getCenter();
    curpos.latitude = center.lat()
    curpos.longitude = center.lng()
    //showlists()
}

function initGoogleMaps(lat,lng,zoom){
    var latlng = new google.maps.LatLng(lat,lng)
    var myOptions = {
      zoom: zoom,
      center: latlng,
      mapTypeId: google.maps.MapTypeId.ROADMAP
    };
    map = new google.maps.Map(document.getElementById("map_canvas"), myOptions);

    // http://sites.google.com/site/gmapsapi3/Home/v3_reference
    google.maps.event.addListener(map, 'dragend', function(){
    	$('#image').attr('src',"https://i.gyazo.com/a9dd5417ae63c06ccddc2040adbd04af.png") // 空白
	locSearchAndDisplay()
    })
    //google.maps.event.addListener(map, 'click', locSearchAndDisplay);
    //google.maps.event.addListener(map, 'zoom_changed', locSearchAndDisplay);
}

function showlists(){
    for(var i=0;i<locations.length;i++){
	entry = locations[i]
	entry.distance = distance(entry.latitude,entry.longitude,curpos.latitude,curpos.longitude)
    }
    locations.sort((a, b) => { // 近い順にソート
	return a.distance > b.distance ? 1 : -1;
    });

    $('#list').empty()
    for(var i=0;i<10 && i<locations.length;i++){
	let loc = locations[i]
	console.log(loc)
	let li = $('<li>')
	let e = $('<a>')
	e.text(loc.title)
	e.attr('href',`https://scrapbox.io/Gyamap/${loc.title}`)
	e.attr('target','_blank')
	li.append(e)
	li.append($('<span>').text(' '))
	
	let img = $('<img>')
	img.attr('src','https://s3-ap-northeast-1.amazonaws.com/masui.org/b/c/bc0c849e6707a5b4f71a4a5ad801f5ea.png')
	img.attr('height','14px')
	img.attr('latitude',loc.latitude)
	img.attr('longitude',loc.longitude)
	img.attr('zoom',loc.zoom)
	img.attr('photo',loc.photo)
	img.click(function(e){
	    map.panTo(new google.maps.LatLng($(e.target).attr('latitude'),$(e.target).attr('longitude')))

	    selectedimage = `${$(e.target).attr('photo')}/raw`
	    $('#image').attr('src',selectedimage)
	    
	    curpos.latitude = $(e.target).attr('latitude')
	    curpos.longitude = $(e.target).attr('longitude')
	    showlists()
	})
	img.mouseover(function(e){
	    $('#image').attr('src',`${$(e.target).attr('photo')}/raw`)
	})
	img.mouseleave(function(e){
	    $('#image').attr('src',selectedimage)
	})
	li.append(img)

	li.append($('<span>').text(' '))
	let desc = $("<span>")
	desc.text(loc.desc)
	li.append(desc)
	
	$('#list').append(li)
    }
}

async function getlist(project){
    var datalist = []
    
    url = `https://scrapbox.io/api/pages/${project}`
    console.log(`url = ${url}`)
    var response = await fetch(url)
    var json = await response.json()
    await Promise.all(json.pages.map(page => fetch(`https://scrapbox.io/api/pages/${project}/${page.title}/text`)
        .then(result => result.text()))
    ).then(results => results.forEach((text) => {
        let desc = ""
        let a = text.split(/\n/)
        let title = a[0]
        if(title[0] != '_'){
            let entry = {}
            for (let i = 1; i < a.length; i++) {
                let line = a[i]
                let match = line.match(/(https?:\/\/gyazo\.com\/[0-9a-f]{32})/) // Gyazo画像
                if (match && !entry.photo) {
                    entry.photo = match[1]
                }
                else {
                    match = line.match(/\[N([\d\.]+),E([\d\.]+),Z([\d\.]+)(\s+\S+)?\]/) // 地図が登録されている場合
                    if (match && !entry.latitude) {
                        entry.title = title
                        entry.latitude = Number(match[1]) // 西経の処理が必要!!
                        entry.longitude = Number(match[2])
                        entry.zoom = Number(match[3])
                    }
                    else {
                        if (!line.match(/^\s*$/) && desc == "") {
                            if (!line.match(/\[http/)) {
                                desc = line.replace(/\[/g, '').replace(/\]/g, '')
                            }
                        }
                    }
                }
            }
            entry.desc = desc
            if (entry.latitude) {
                datalist.push(entry)
                // console.log(`datalist.length = ${datalist.length}`)
            }
        }
    }))
    console.log('end')
    return datalist
}
