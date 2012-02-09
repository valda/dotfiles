// ==UserScript==
// @name        refererChanger
// @include     main
// @include     chrome://browser/content/browser.xul
// @version     1.0.3
// @description Refererの内容を柔軟に書き換えるUserScriptです。
// ==/UserScript==
// @version        2010/04/28 15:44 sites配列とアクセスしようとしているサーバーのドメインが一部だけ一致した場合でも書き換えるようにした(1.0.3)
// @version        2009/10/26 21:31 ステータスバーにトグルアイコンを「ツール」メニューにトグルメニューを追加(1.0.2)
// @version        2009/10/26 21:31 リファラの自由指定が指定出来てなかったので修正(1.0.1)
// ◆設定方法
//   スクリプト内のsites配列（ハッシュ配列）にリファラーを書き換えたいサイトと書き換え方法を指定すれば次回userChrome.jsロード時から書き換えてくれます。
//   sites配列の書き方はハッシュのkeyに書き換え対象のドメインを、valueに書き換え方法を指定して下さい。
// ◇sites配列のvalue指定方法
//   @NORMAL：リファラを変更しない
//   @FORGE：開こうとしているサーバのルートに
//   @ORIGINAL：開こうとしているサイトのURLを送信する
//   @BLOCK : リファラを空にして送信
//   無指定：開こうとしているサーバが別サーバだとそのサーバのルートに、ドキュメントと同じサーバーから開かれたようにする
//   それ以外 : 指定された内容にリファラを書き換える。
refChangerFlg = true;

refererChanger:{
	let Cc = Components.classes;
	let Ci = Components.interfaces;
	let list = Cc['@mozilla.org/appshell/window-mediator;1'].getService(Ci.nsIWindowMediator).getEnumerator('navigator:browser');
	while(list.hasMoreElements()){ if(list.getNext() != window) break refererChanger; }
	// *********Config Start**********
	//ツールメニューに「RefererChangerを実行」メニューを追加
	var menuHidden = true;

	var logs = Components.classes["@mozilla.org/consoleservice;1"] .getService(Components.interfaces.nsIConsoleService);

	var sites = {
		'image.itmedia.co.jp' : '@FORGE',
		'img.itmedia.co.jp' : '@FORGE',
		'plusd.itmedia.co.jp' : '@FORGE',
		'2ch.net' : '@FORGE',
		'imepita.jp' : '@ORIGINAL',
		'tumblr.com' : '@FORGE',
		'fc2.com' : '@BLOCK',
		'blogs.yahoo.co.jp' : '@BLOCK',
		'hentaiverse.net': '@BLOCK',
		'rakuten-static.com': '@NORMAL',
		'rakuten.co.jp': '@NORMAL',
		'api.e-map.ne.jp': '@NORMAL',
	    'pics.dmm.co.jp' : '@FORGE',
	    'stat.ameba.jp' : '@BLOCK',
		//下はデバッグ用
		//'taruo.net' : 'example.co.jp',
	};
	// *********Config End**********
    //var statusbarHidden = true;
	var adjustRef = function (http, site) {
		try {
		  var sRef;
		  var refAction = undefined;
		  for (var i in sites) {
			if(site.indexOf(i) != -1){
				refAction = sites[i];
				break;
			}
		  }

		  if (refAction == undefined)
			return false;
		  if (refAction.charAt(0) == '@'){
			//下はデバッグ用
			//logs.logStringMessage("ReferrerChanger:  " + http.originalURI.spec + " : "+refAction);
			//logs.logStringMessage("ReferrerChanger:  OriginalReferrer: "+http.referrer.spec);

			switch (refAction){
				case '@NORMAL':
			        return true;
			        break;
				case '@FORGE':
			        sRef = http.URI.scheme + "://" + http.URI.hostPort + "/";
			        break;
				case '@BLOCK':
			      	sRef = "";
			      	break;
				case '@AUTO':
					return false;
				case '@ORIGINAL':
					sRef = window.content.document.location.href;
			        break;
			    default:
			    	return false;
			    	break;
			}
		  }else if(refAction.length == 0) {
		  	return false;
		  }else{
		  	sRef= refAction;
		  }
		  http.setRequestHeader("Referer", sRef, false);
			if (http.referrer)
				http.referrer.spec = sRef;
			return true;
		} catch (e) {}
			return false;
	}
	if(menuHidden){//ツールメニューにON/OFFチェックを実装
		var menuitem = document.createElement("menuitem");
		menuitem.setAttribute("id", "refererChangerToggle");
		menuitem.setAttribute("label", "RefererChanger Toggle");
		menuitem.setAttribute("type", "checkbox");
		menuitem.setAttribute("autocheck", "false");
		menuitem.setAttribute("checked", "true");
		menuitem.setAttribute("oncommand", "RCToggle();");
		document.getElementById("devToolsSeparator").parentNode.insertBefore(menuitem, document.getElementById("devToolsSeparator"));
	}
    //if(statusbarHidden){
		var statusbarpanel = document.createElement("statusbarpanel");
		statusbarpanel.setAttribute("id", "refererChangerTogglePanel");
		statusbarpanel.setAttribute("label", "RC(ON)");
		statusbarpanel.setAttribute("tooltiptext", "RefererChanger\u306f\u73fe\u5728\u6709\u52b9\u3067\u3059\u3002");
		statusbarpanel.setAttribute("class", "statusbarpanel-iconic");
		statusbarpanel.setAttribute("src", "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAACDUlEQVR42qWRzU9TURDF5x+xSkHAlvZRF67ZuTEvLIx/gAm6lBULVARTwaKgIohfESjE+PGwWlBpQTEgHwVCVHDjghg1hg2JS1eO584M5DVx5+Lk3rb3/M6ZKZH3Zo5S75kOL0Or0ApTaompfo7xG1NyiqnuBVPsKdOhMaaaB0zVt5mqbjAdHGQib2ZeHqcWDVLSe/08AG8NkGeKBwA8ZKodBuAOAH0ADACQnALgnRpSCyp3d995M0yJVwA8R4Mn/2jgAHX5BXnozarJ5J1Y5sbmdW48s8YxfxqAR0jPAnAfxlsG6AcgNr5IideoWtREJ9yD6W3+w7ynpraS1b+ryZXXdAyKPV6SGROT0EvTJAA/xRj3C3LOrmxb+qCmV/boSTXZkiwo/kxndcI9KP4QY1D8JmfP0IYuz9V26dFunL0AVN9ble26GUMKit/LRjhyPKfVq67DeJWpoktbYCFrMlvtCDRqynJQ+CrGpD8u583RT1Yd5uhlANLaAnXWZTFuvpCCwpYYXerOr9+8+WXHzBmYLzEd6FAQVWQ+yFyunvt7RAN89GSe/dMTUvlYU479UzlLNvP+C7h3OkD6oyzDLaZMvTpj9IqldmptMbdB5xQG0oY8EHWHlLHEXeNFqN3M55kiZw0Qad2UB+5DmdIho1XeNUZaVQLY1/JZyO5RmdrNZImucti8ByBq+B/9BacI21yKq2knAAAAAElFTkSuQmCC");
		statusbarpanel.setAttribute("onclick", "RCToggle();");
		document.getElementById("status-bar").appendChild(statusbarpanel);
	//}
	Cc['@mozilla.org/observer-service;1'].getService(Ci.nsIObserverService).addObserver({
		observe: function(subject,topic,data){
			if(topic != 'http-on-modify-request') return;
			if(document.getElementById('refererChangerTogglePanel').getAttribute('tooltiptext') == "RefererChanger\u306f\u73fe\u5728\u7121\u52b9\u3067\u3059\u3002") return;
			var http = subject.QueryInterface(Ci.nsIHttpChannel);
			for (var s = http.URI.host; s != ""; s = s.replace(/^.*?(\.|$)/, "")){
			if (adjustRef(http, s))
				return;
			}
			if(http.referrer && http.referrer.host != http.originalURI.host)
				http.setRequestHeader('Referer', http.originalURI.spec.replace(/[^/]+$/,''), false);
		}
	},'http-on-modify-request',false);
}

function RCToggle(){
	let statusbarpanel = document.getElementById('refererChangerTogglePanel');
	let menuitem = document.getElementById('refererChangerToggle');
	try{
		menuitem.setAttribute("checked", !(menuitem.getAttribute("checked") == "true"));
		if(refChangerFlg){
			statusbarpanel.setAttribute("tooltiptext","RefererChanger\u306f\u73fe\u5728\u7121\u52b9\u3067\u3059\u3002");
			statusbarpanel.setAttribute("src", "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAACGklEQVR42qVRSU8iYRTsnza/ioPsRtlEQKKyhqgYArKjuLBpQHZCHJi5EoPEeOHOrearN+lJT+Y4nVS+11+/qlevWmu3293X11eMRiNMp1NMJhMMh0N0u12ob3h8fES1WkU+n8f19TVSqRSi0ShOTk4QiUSgtVqtHpsHg4GIjMdjqXu9HjqdjgjUajUUCgVkMhlcXFwgFoshHA7j7OwMmmrovby8CKHf7wtY806J4/7+HpVKBTc3N/84EAGl3mfj8/OzkHTQzXw+x2w2Q7PZRDabxdXVFZLJJM7Pz0Xg9PQUWrFYHDw8PKDRaMhEgvXX1xeMD1ej/Xg8LpODwaCsoeVyuSF3vLu7Q71eF7D+/PwU4tPTk5wU5HQGx+nHx8dyasrWmAGVSiXZlWC92WyEuF6v5VwulxIebXO6z+dDIBCAlkgkpkyXOxrx8fHx1wrlclmsh0Ih+P1+uN1ucaGpQGbc7fLyEul0WsCw3t/fhagyknOxWIhlkj0eDw4ODsSFpuzMGQz3M2K1WgmRU3e7HbbbrZC9Xi8ODw/hdDpFSFMXb9yLjfw9BGsGe3t7K5ZpnyBBJ9vtdrhcLmjKyneGwWCM4B13PDo6kqlspm2SbTYbLBaLiGlKackGgjvp4Dsn6sT9/X04HA4hW61WmM3m3wJ7e3s/2MAXI3inE3XLOlFxBCJgMpl+UplNRvCOJH0iLRvJfwTU8+1/8AvgDb8WTQLLxwAAAABJRU5ErkJggg%3D%3D");
		}else{
			statusbarpanel.setAttribute("tooltiptext","RefererChanger\u306f\u73fe\u5728\u6709\u52b9\u3067\u3059\u3002");
			statusbarpanel.setAttribute("src", "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAACDUlEQVR42qWRzU9TURDF5x+xSkHAlvZRF67ZuTEvLIx/gAm6lBULVARTwaKgIohfESjE+PGwWlBpQTEgHwVCVHDjghg1hg2JS1eO584M5DVx5+Lk3rb3/M6ZKZH3Zo5S75kOL0Or0ApTaompfo7xG1NyiqnuBVPsKdOhMaaaB0zVt5mqbjAdHGQib2ZeHqcWDVLSe/08AG8NkGeKBwA8ZKodBuAOAH0ADACQnALgnRpSCyp3d995M0yJVwA8R4Mn/2jgAHX5BXnozarJ5J1Y5sbmdW48s8YxfxqAR0jPAnAfxlsG6AcgNr5IideoWtREJ9yD6W3+w7ynpraS1b+ryZXXdAyKPV6SGROT0EvTJAA/xRj3C3LOrmxb+qCmV/boSTXZkiwo/kxndcI9KP4QY1D8JmfP0IYuz9V26dFunL0AVN9ble26GUMKit/LRjhyPKfVq67DeJWpoktbYCFrMlvtCDRqynJQ+CrGpD8u583RT1Yd5uhlANLaAnXWZTFuvpCCwpYYXerOr9+8+WXHzBmYLzEd6FAQVWQ+yFyunvt7RAN89GSe/dMTUvlYU479UzlLNvP+C7h3OkD6oyzDLaZMvTpj9IqldmptMbdB5xQG0oY8EHWHlLHEXeNFqN3M55kiZw0Qad2UB+5DmdIho1XeNUZaVQLY1/JZyO5RmdrNZImucti8ByBq+B/9BacI21yKq2knAAAAAElFTkSuQmCC");
		}
	}catch(e){}
	refChangerFlg = !refChangerFlg;
}


