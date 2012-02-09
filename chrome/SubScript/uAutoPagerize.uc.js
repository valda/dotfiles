// ==UserScript==
// @name           uAutoPagerize
// @namespace      http://d.hatena.ne.jp/Griever/
// @description    loading next page and inserting into current page.
// @include        main
// @compatibility  Firefox 5.0
// @version        0.2.0
// @note           INCLUDE を設定できるようにした
// @note           INCLUDE, EXCLUDE をワイルドカード式にした
// @note           アイコンに右クリックメニューを付けた
// @note           スクロールするまでは次を読み込まないオプションをつけた
// ==/UserScript==

// this script based on
// AutoPagerize version: 0.0.41 2009-09-05T16:02:17+09:00 (http://autopagerize.net/)
// oAutoPagerize (http://d.hatena.ne.jp/os0x/searchdiary?word=%2a%5boAutoPagerize%5d)
//
// Released under the GPL license
// http://www.gnu.org/copyleft/gpl.html

(function(css) {

// ワイルドカード(*)で記述する
var INCLUDE = [
	"*"
];
var EXCLUDE = [
	'https://mail.google.com/*'
	,'http://www.google.co.jp/reader/*'
	,'http://b.hatena.ne.jp/*'
	,'http://www.livedoor.com/*'
	,'http://reader.livedoor.com/*'
	,'http://fastladder.com/*'
];

var MY_SITEINFO = [
	{
		url         : 'http://eow\\.alc\\.co\\.jp/[^/]+'
		,nextLink   : 'id("AutoPagerizeNextLink")'
		,pageElement: 'id("resultsList")/ul'
		,exampleUrl : 'http://eow.alc.co.jp/%E3%81%82%E3%82%8C/UTF-8/ http://eow.alc.co.jp/are'
	},
	{
		url         : '^http://(?:images|www)\\.google(?:\\.[^./]{2,3}){1,2}/(images\\?|search\\?.*tbm=isch)'
		,nextLink   : 'id("nn")/parent::a | id("navbar navcnt nav")//td[last()]/a'
		,pageElement: 'id("ImgCont ires")/table | id("ImgContent")'
		,exampleUrl : 'http://images.google.com/images?ndsp=18&um=1&safe=off&q=image&sa=N&gbv=1&sout=1'
	},
	{
		url         : '^http://matome\\.naver\\.jp/\\w+'
		,nextLink   : '//div[contains(concat(" ", @class, " "), " MdPagination03 ")]/strong[1]/following-sibling::a[1]'
		,pageElement: '//div[contains(concat(" ", @class, " "), " MdMTMWidgetList01 ")]'
		,exampleUrl : 'http://matome.naver.jp/odai/2127476492987286301'
	},
	{
		url         : '^https?://mobile\\.twitter\\.com/'
		,nextLink   : 'id("more_link") | //div[contains(concat(" ", @class, " "), " full-button ") or contains(concat(" ", @class, " "), " list-more ")]/a'
		,pageElement: '//div[contains(concat(" ", @class, " "), " list-tweet ")]'
		,exampleUrl : 'http://mobile.twitter.com/searches?q=%23css'
	},
	{
		url          : '^https?://gist\\.github\\.com/(?!gists/\\d+|\\d+$).'
		,nextLink    : '//div[contains(concat(" ",normalize-space(@class)," "), " pagination ")]/*[count(following-sibling::*)=0 and @href]'
		,pageElement : 'id("files")/*'
		,exampleUrl  : 'https://gist.github.com/Griever'
	}
];

var MICROFORMAT = [
	{
		url        : '^https?://.',
		nextLink   : '//link[contains(concat(" ", translate(normalize-space(@rel), "ENTX", "entx"), " "), " next ")] | //a[contains(concat(" ", translate(normalize-space(@rel), "ENTX", "entx"), " "), " next ")]',
		pageElement: '//*[contains(concat(" ", normalize-space(@class), " "), " hentry ")]'
	},
	{
		url         : '^https?://.*',
		nextLink    : '//a[@rel="next"] | //link[@rel="next"]',
		pageElement : '//*[contains(@class, "autopagerize_page_element")]',
		insertBefore: '//*[contains(@class, "autopagerize_insert_before")]',
	}
];

var SITEINFO_IMPORT_URLS = [
	'http://wedata.net/databases/AutoPagerize/items.json'
];

var COLOR = {
	on: '#0f0',
	off: '#ccc',
	enable: '#0f0',
	disable: '#ccc',
	loading: '#0ff',
	terminated: '#00f',
	error: '#f0f'
}


let { classes: Cc, interfaces: Ci, utils: Cu, results: Cr } = Components;
if (!window.Services) Cu.import("resource://gre/modules/Services.jsm");

if (typeof window.uAutoPagerize != 'undefined') {
	window.uAutoPagerize.theEnd();
}

// 以下 設定が無いときに利用する
var ADD_HISTORY = false;
var FORCE_TARGET_WINDOW = true;
var BASE_REMAIN_HEIGHT = 400;
var DEBUG = false;
var AUTO_START = true;
var SCROLL_ONLY = false;
var CACHE_EXPIRE = 24 * 60 * 60 * 1000;
var XHR_TIMEOUT = 30 * 1000;


var ns = window.uAutoPagerize = {
	_INCLUDE       : INCLUDE,
	_EXCLUDE       : EXCLUDE,
	INCLUDE_REGEXP : /./,
	EXCLUDE_REGEXP : /^$/,
	MICROFORMAT    : MICROFORMAT,
	MY_SITEINFO    : MY_SITEINFO,
	SITEINFO       : [],

	get prefs() {
		delete this.prefs;
		return this.prefs = Services.prefs.getBranch("uAutoPagerize.")
	},
	get INCLUDE() {
		return this._INCLUDE;
	},
	set INCLUDE(arr) {
		try {
			let regs = arr.map(function(val) wildcardToRegExpStr(val));
			this.INCLUDE_REGEXP = new RegExp(regs.join("|"));
			this._INCLUDE = arr;
		} catch (e) {
			log(U("INCLUDE が不正です"));
		}
		return arr;
	},
	get EXCLUDE() {
		return this._EXCLUDE;
	},
	set EXCLUDE(arr) {
		try {
			let regs = arr.map(function(val) wildcardToRegExpStr(val));
			this.EXCLUDE_REGEXP = new RegExp(regs.join("|"));
			this._EXCLUDE = arr;
		} catch (e) {
			log(U("INCLUDE が不正です"));
		}
		return arr;
	},
	get AUTO_START() AUTO_START,
	set AUTO_START(bool) {
		updateIcon();
		return AUTO_START = !!bool;
	},
	get BASE_REMAIN_HEIGHT() BASE_REMAIN_HEIGHT,
	set BASE_REMAIN_HEIGHT(num) {
		num = parseInt(num, 10);
		if (!num) return num;
		let m = $("uAutoPagerize-BASE_REMAIN_HEIGHT");
		if (m) m.setAttribute("tooltiptext", BASE_REMAIN_HEIGHT = num);
		return num;
	},
	get DEBUG() DEBUG,
	set DEBUG(bool) {
		let m = $("uAutoPagerize-DEBUG");
		if (m) m.setAttribute("checked", DEBUG = !!bool);
		return bool;
	},
	get ADD_HISTORY() ADD_HISTORY,
	set ADD_HISTORY(bool) {
		let m = $("uAutoPagerize-ADD_HISTORY");
		if (m) m.setAttribute("checked", ADD_HISTORY = !!bool);
		return bool;
	},
	get FORCE_TARGET_WINDOW() FORCE_TARGET_WINDOW,
	set FORCE_TARGET_WINDOW(bool) {
		let m = $("uAutoPagerize-FORCE_TARGET_WINDOW");
		if (m) m.setAttribute("checked", FORCE_TARGET_WINDOW = !!bool);
		return bool;
	},
	get SCROLL_ONLY() SCROLL_ONLY,
	set SCROLL_ONLY(bool) {
		let m = $("uAutoPagerize-SCROLL_ONLY");
		if (m) m.setAttribute("checked", SCROLL_ONLY = !!bool);
		return bool;
	},

	get historyService() {
		delete historyService;
		return historyService = Cc["@mozilla.org/browser/global-history;2"].getService(Ci.nsIBrowserHistory);
	},

	init: function() {
		ns.style = addStyle(css);
/*
		ns.icon = $('status-bar').appendChild($E(
			<statusbarpanel id="uAutoPagerize-icon"
			                class="statusbarpanel-iconic-text"
			                state="disable"
			                tooltiptext="disable"
			                onclick="if(event.button != 2) uAutoPagerize.iconClick(event);"
			                context=""/>
		));
*/
		ns.icon = $('urlbar-icons').appendChild($E(
			<image id="uAutoPagerize-icon"
			       state="disable"
			       tooltiptext="disable"
			       onclick="if(event.button != 2) uAutoPagerize.iconClick(event);"
			       context="uAutoPagerize-popup"
			       style="padding: 0px 2px;"/>
		));
/*
		ns.context = $('contentAreaContextMenu').appendChild($E(
			<menuitem id="uAutoPagerize-context"
			          class="menuitem-iconic"
			          label="uAutoPagerize ON/OFF"
			          state="disable"
			          tooltiptext="disable"
			          oncommand="uAutoPagerize.iconClick(event);"/>
		));
*/

		ns.popup = $('mainPopupSet').appendChild($E(
			<menupopup id="uAutoPagerize-popup">
				<menuitem label={U("ON/OFF 切り替え")}
				          oncommand="uAutoPagerize.toggle(event);"/>
				<menuitem label={U("SITEINFO の更新")}
				          oncommand="uAutoPagerize.resetSITEINFO();" />
				<menuseparator />
				<menuitem label={U("継ぎ足したページのリンクは新しいタブで開く")}
				          id="uAutoPagerize-FORCE_TARGET_WINDOW"
				          type="checkbox"
				          autoCheck="false"
				          checked={FORCE_TARGET_WINDOW}
				          oncommand="uAutoPagerize.FORCE_TARGET_WINDOW = !uAutoPagerize.FORCE_TARGET_WINDOW;" />
				<menuitem label={U("先読みの開始位置")}
				          id="uAutoPagerize-BASE_REMAIN_HEIGHT"
				          tooltiptext={BASE_REMAIN_HEIGHT}
				          oncommand="uAutoPagerize.BASE_REMAIN_HEIGHT = prompt('', uAutoPagerize.BASE_REMAIN_HEIGHT);" />
				<menuitem label={U("スクロールするまで次のページを読み込まない")}
				          id="uAutoPagerize-SCROLL_ONLY"
				          type="checkbox"
				          autoCheck="false"
				          checked={SCROLL_ONLY}
				          oncommand="uAutoPagerize.SCROLL_ONLY = !uAutoPagerize.SCROLL_ONLY;" />
				<menuitem label={U("継ぎ足したページを履歴に入れる")}
				          id="uAutoPagerize-ADD_HISTORY"
				          type="checkbox"
				          autoCheck="false"
				          checked={ADD_HISTORY}
				          oncommand="uAutoPagerize.ADD_HISTORY = !uAutoPagerize.ADD_HISTORY;" />
				<menuitem label={U("デバッグモード")}
				          id="uAutoPagerize-DEBUG"
				          type="checkbox"
				          autoCheck="false"
				          checked={DEBUG}
				          oncommand="uAutoPagerize.DEBUG = !uAutoPagerize.DEBUG;" />
			</menupopup>
		));

		["DEBUG", "AUTO_START", "ADD_HISTORY", "FORCE_TARGET_WINDOW", "SCROLL_ONLY"].forEach(function(name) {
			try {
				ns[name] = ns.prefs.getBoolPref(name);
			} catch (e) {}
		}, ns);
		try {
			ns["BASE_REMAIN_HEIGHT"] = ns.prefs.getIntPref("BASE_REMAIN_HEIGHT");
		} catch (e) {}

		if (!getCache())
			requestSITEINFO();
		ns.INCLUDE = ns._INCLUDE;
		ns.EXCLUDE = ns._EXCLUDE;
		ns.addListener();
		updateIcon();
	},
	uninit: function() {
		ns.removeListener();
		saveFile('uAutoPagerize.json', JSON.stringify(ns.SITEINFO));
		["DEBUG", "AUTO_START", "ADD_HISTORY", "FORCE_TARGET_WINDOW", "SCROLL_ONLY"].forEach(function(name) {
			try {
				ns.prefs.setBoolPref(name, ns[name]);
			} catch (e) {}
		}, ns);
		try {
			ns.prefs.setIntPref("BASE_REMAIN_HEIGHT", ns["BASE_REMAIN_HEIGHT"]);
		} catch (e) {}
	},
	theEnd: function() {
		var ids = ["uAutoPagerize-icon", "uAutoPagerize-context", "uAutoPagerize-popup"];
		for (let [, id] in Iterator(ids)) {
			let e = document.getElementById(id);
			if (e) e.parentNode.removeChild(e);
		}
		ns.style.parentNode.removeChild(ns.style);
		ns.removeListener();
	},
	destroy: function() {
		ns.theEnd();
		ns.uninit();
		delete window.uAutoPagerize;
	},
	addListener: function() {
		gBrowser.mPanelContainer.addEventListener('DOMContentLoaded', this, true);
		//$('sidebar').addEventListener('DOMContentLoaded', this, true);
		gBrowser.mTabContainer.addEventListener('TabSelect', this, false);
		window.addEventListener('uAutoPagerize_destroy', this, false);
		window.addEventListener('unload', this, false);
	},
	removeListener: function() {
		gBrowser.mPanelContainer.removeEventListener('DOMContentLoaded', this, true);
		//$('sidebar').removeEventListener('DOMContentLoaded', this, true);
		gBrowser.mTabContainer.removeEventListener('TabSelect', this, false);
		window.removeEventListener('uAutoPagerize_destroy', this, false);
		window.removeEventListener('unload', this, false);
	},
	handleEvent: function(event) {
		switch(event.type) {
			case "DOMContentLoaded":
				if (this.AUTO_START)
					this.launch(event.target.defaultView);
				break;
			case "TabSelect":
				if (this.AUTO_START)
					updateIcon();
				break;
			case "uAutoPagerize_destroy":
				this.destroy(event);
				break;
			case "unload":
				this.uninit(event);
				break;
		}
	},
	getFocusedWindow: function() {
		var win = document.commandDispatcher.focusedWindow;
		if (!win || win == window)
			win = content;
		return win;
	},
	launch: function(win, timer){
		var locationHref = win.location.href;
		if (locationHref.indexOf('http') !== 0 ||
		   !ns.INCLUDE_REGEXP.test(locationHref) || 
		    ns.EXCLUDE_REGEXP.test(locationHref))
			return updateIcon();

		var doc = win.document;
		if (!/html|xml/i.test(doc.contentType) ||
		    doc.body instanceof HTMLFrameSetElement ||
		    win.frameElement && !(win.frameElement instanceof HTMLFrameElement) ||
		    doc.querySelector('meta[http-equiv="refresh"]'))
			return updateIcon();

		if (typeof win.AutoPagerize == 'undefined') {
			win.filters         = [];
			win.documentFilters = [];
			win.requestFilters  = [];
			win.responseFilters = [];
			win.AutoPagerize = {
				addFilter         : function(f) { win.filters.push(f) },
				addDocumentFilter : function(f) { win.documentFilters.push(f); },
				addResponseFilter : function(f) { win.responseFilters.push(f); },
				addRequestFilter  : function(f) { win.requestFilters.push(f); },
				launchAutoPager   : function(l) { launchAutoPager_org(l, win); }
			}
			// uAutoPagerize original
			win.fragmentFilters = [];
		}
		var ev = doc.createEvent('Event');
		ev.initEvent('GM_AutoPagerizeLoaded', true, false);
		doc.dispatchEvent(ev);

		var miscellaneous = [];
		// 継ぎ足されたページからは新しいタブで開く
		win.fragmentFilters.push(function(df){
			if (!ns.FORCE_TARGET_WINDOW) return;
			var arr = Array.slice(df.querySelectorAll('a[href]:not([href^="mailto:"]):not([href^="javascript:"]):not([href^="#"])'));
			arr.forEach(function (elem){
				elem.setAttribute('target', '_blank');
			});
		});
		win.documentFilters.push(function(_doc, _requestURL, _info) {
			if (!ns.ADD_HISTORY) return;
			var uri = makeURI(_requestURL);
			ns.historyService.removePage(uri)
			ns.historyService.addPageWithDetails(uri, _doc.title, new Date().getTime() * 1000);
		});

		if (/^http\:\/\/\w+\.google\.(co\.jp|com)/.test(locationHref)) {
			if (!timer || timer < 400) timer = 400;
			win.addEventListener("hashchange", function(event) {
				if (!win.ap) {
					win.setTimeout(function(){
						let [index, info] = [-1, null];
						if (!info) [, info] = ns.getInfo(ns.MY_SITEINFO, win);
						if (!info) [, info] = ns.getInfo(ns.SITEINFO, win);
						if (info) win.ap = new AutoPager(win.document, info);
						updateIcon();
					}, timer);
					return;
				}
				let info = win.ap.info;
				win.ap.destroy(true);
				win.setTimeout(function(){
					win.ap = new AutoPager(win.document, info);
					updateIcon();
				}, timer);
			}, false);
		}
		if (/^https?:\/\/[^.]+\.google\.(?:[^.]{2,3}\.)?[^./]{2,3}\/.*?\b(vid(?:%3A|:)1|tbm=vid)/i.test(locationHref)) {
			// Google Video
			var js = '';
			var df = function (newDoc) {
				Array.slice(doc.querySelectorAll('[id^="vidthumb"]')).forEach(function(e){
					e.removeAttribute('id');
				});
				var x = getElementsByXPath('//script/text()[starts-with(self::text(), "(function(x){x&&(x.src=")]', newDoc);
				js = x.map(function(e) e.textContent).join('\n');
			}
			var af = function af(elems) {
				var s = doc.createElement('script');
				s.type = 'text/javascript';
				s.textContent = js;
				doc.body.appendChild(s);
				js = '';
			}
			win.documentFilters.push(df);
			doc.addEventListener("GM_AutoPagerizeNextPageLoaded", af, false);
		}
		else if (/^http:\/\/(?:images|www)\.google(?:\.[^.\/]{2,3}){1,2}\/(images\?|search\?.*tbm=isch)/.test(locationHref)) {
			// Google Image
			let [, info] = ns.getInfo(ns.MY_SITEINFO, win);
			if (info && getFirstElementByXPath(info.pageElement, doc)) {
				if (!timer || timer < 1000) timer = 1000;
				win.requestFilters.push(function(opt) {
					opt.url = opt.url
						.replace(/&?(gbv=\d|sout=\d)/g, "")
						.replace("?", '?gbv=1&sout=1&')
				});
			}
		}
		else if (win.location.host === 'twitter.com') {
			win.documentFilters.push(function(_doc, _requestURL, _info) {
				win.ap.requestURL = win.ap.lastRequestURL;
			});
		}
		// oAutoPagerize
		else if (win.location.host === 'eow.alc.co.jp') {
			var alc = function(_doc){
				var a,r = _doc.evaluate('//p[@id="paging"]/a[last()]',
					_doc,null,XPathResult.FIRST_ORDERED_NODE_TYPE,null);
				if (r.singleNodeValue) a = r.singleNodeValue;
				else return;
				a.id = 'AutoPagerizeNextLink';
				a.href = a.href.replace(/javascript:goPage\("(\d+)"\)/,'./?pg=$1');
			};
			win.documentFilters.push(alc);
			miscellaneous.push(alc);
		}
		else if (win.location.host === 'matome.naver.jp') {
			let [, info] = ns.getInfo(ns.MY_SITEINFO, win);
			if (info) {
				var naver = function(_doc){
					var next = getFirstElementByXPath(info.nextLink, _doc);
					if (next) {
						next.href = win.location.pathname + '?page=' + next.textContent;
					}
				}
				win.documentFilters.push(naver);
				miscellaneous.push(naver);
			}
		}
		else if (win.location.host === "www.youtube.com") {
			// from youtube_AutoPagerize_fix.js https://gist.github.com/761717
			win.fragmentFilters.push(function(df) {
				Array.slice(df.querySelectorAll('img[data-thumb]')).forEach(function(img) {
					img.src = img.getAttribute('data-thumb');
					img.removeAttribute('data-thumb');
				});
			});
		}

		win.setTimeout(function(){
			win.ap = null;
			miscellaneous.forEach(function(func){ func(doc); });
			var index = -1;
			var [, info] = ns.getInfo(ns.MY_SITEINFO, win);
			//var s = new Date().getTime();
			if (!info) [index, info] = ns.getInfo(ns.SITEINFO, win);
			//debug(index + 'th/' + (new Date().getTime() - s) + 'ms');
			if (!info) [, info] = ns.getInfo(ns.MICROFORMAT, win);
			if (info) win.ap = new AutoPager(win.document, info);

			updateIcon();
			if (info && index > 20 && !/tumblr|fc2/.test(info.url)) {
				ns.SITEINFO.splice(index, 1);
				ns.SITEINFO.unshift(info);
			}
		}, timer||0);
	},
	iconClick: function(event){
		if (!event.button) {
			ns.toggle();
		}
		else if (event.button == 1) {
			if (confirm('reset SITEINFO?'))
				requestSITEINFO();
		}
	},
	resetSITEINFO: function() {
		if (confirm('reset SITEINFO?'))
			requestSITEINFO();
	},
	toggle: function() {
		if (ns.AUTO_START) {
			ns.AUTO_START = false;
			updateIcon();
		} else {
			ns.AUTO_START = true;
			if (!content.ap)
				ns.launch(content);
			else updateIcon();
		}
	},
	getInfo: function (list, win) {
		if (!list) list = ns.SITEINFO;
		if (!win)  win  = content;
		var doc = win.document;
		var locationHref = doc.location.href;
		for (let [index, info] in Iterator(list)) {
			try {
				var exp = info.url_regexp || Object.defineProperty(info, "url_regexp", {
						enumerable: false,
						value: new RegExp(info.url)
					}).url_regexp;
				if ( !exp.test(locationHref) ) {
				} else if (!getFirstElementByXPath(info.nextLink, doc)) {
					// ignore microformats case.
					if (!exp.test('http://a'))
						debug('nextLink not found.', info.nextLink);
				} else if (!getFirstElementByXPath(info.pageElement, doc)) {
					if (!exp.test('http://a')) 
						debug('pageElement not found.', info.pageElement);
				} else {
					return [index, info];
				}
			} catch(e) {
				log('error at launchAutoPager() : ' + e);
			}
		}
		return [-1, null];
	},
	getInfoFromURL: function (url) {
		if (!url) url = content.location.href;
		var list = ns.SITEINFO;
		return list.filter(function(info, index, array) {
			try {
				var exp = info.url_regexp || Object.defineProperty(info, "url_regexp", {
						enumerable: false,
						value: new RegExp(info.url)
					}).url_regexp;
				return exp.test(url);
			} catch(e){ }
		});
	},
};

// Class
function AutoPager(doc, info) {
	this.init.apply(this, arguments);
};
AutoPager.prototype = {
	req: null,
	pageNum: 1,
	_state: 'disable',
	get state() this._state,
	set state(state) {
		if (this.state !== "terminated" && this.state !== "error") {
			if (state === "disabled") {
				this.abort();
			}
			else if (state === "terminated" && state === "error") {
				this.removeListener();
			}
			else if (state !== "loading" || this.isFrame) {
				Array.forEach(this.doc.getElementsByClassName('autopagerize_icon'), function(e) {
					e.style.background = COLOR[state];
				});
			}
			this._state = state;
			updateIcon();
		}
		return state;
	},
	init: function(doc, info) {
		this.doc = doc;
		this.win = doc.defaultView;
		this.documentElement = doc.documentElement;
		this.body = doc.body;
		this.isXML = this.doc.contentType.indexOf('xml') > 0;
		this.isFrame = this.win.top != this.win;
		this.info = {};
		for (let [key, val] in Iterator(info)) {
			this.info[key] = val;
		}
		
		var url = this.getNextURL(this.doc);
		if ( !url ) {
			debug("getNextURL returns null.", this.info.nextLink);
			return;
		}

		this.setInsertPoint();
		if (!this.insertPoint) {
			debug("insertPoint not found.", this.info.pageElement);
			return;
		}
		this.setRemainHeight();

		if (this.isFrame)
			this.initIcon();

		this.requestURL = url;
		this.loadedURLs = {};
		this.loadedURLs[doc.location.href] = true;

		this.state = "enable";
		this.win.addEventListener("pagehide", this, false);
		this.addListener();

		if (!ns.SCROLL_ONLY)
			this.scroll();
		if (this.getScrollHeight() == this.win.innerHeight)
			this.body.style.minHeight = (this.win.innerHeight + 1) + 'px';
	},
	destroy: function(isRemoveAddPage) {
		this.state = "disable";
		this.win.removeEventListener("pagehide", this, false);
		this.removeListener();
		this.abort();

		if (isRemoveAddPage) {
			var separator = this.doc.querySelector('.autopagerize_page_separator, .autopagerize_page_info');
			var range = this.doc.createRange();
			if (separator) {
				range.setStartBefore(separator);
				range.setEndAfter(this.insertPoint);
			} else {
				range.selectNode(this.insertPoint);
			}
			range.deleteContents();
			range.detach();
		}

		this.win.ap = null;
	},
	addListener: function() {
		this.win.addEventListener("scroll", this, false);
		//this.doc.addEventListener("AutoPagerizeToggleRequest", this, false);
		//this.doc.addEventListener("AutoPagerizeEnableRequest", this, false);
		//this.doc.addEventListener("AutoPagerizeDisableRequest", this, false);
	},
	removeListener: function() {
		this.win.removeEventListener('scroll', this, false);
		//this.doc.removeEventListener("AutoPagerizeToggleRequest", this, false);
		//this.doc.removeEventListener("AutoPagerizeEnableRequest", this, false);
		//this.doc.removeEventListener("AutoPagerizeDisableRequest", this, false);
	},
	handleEvent: function(event) {
		switch(event.type) {
			case "scroll":
				this.scroll();
				break;
			case "click":
				this.stateToggle();
				break;
			case "pagehide":
				this.abort();
				break;
			case "AutoPagerizeToggleRequest":
				this.stateToggle();
				break;
			case "AutoPagerizeEnableRequest":
				this.state = "enable";
				break;
			case "AutoPagerizeDisableRequest":
				this.state = "disable";
				break;
		}
	},
	stateToggle: function() {
		this.state = this.state == 'disable'? 'enable' : 'disable';
	},
	scroll : function(){
		if (this.state !== 'enable' || !ns.AUTO_START) return;
		var remain = this.getScrollHeight() - this.win.innerHeight - this.win.scrollY;
		if (remain < this.remainHeight) {
			this.request();
		}
	},
	abort: function() {
		if (this.req) {
			this.req.abort();
			this.req = null;
		}
	},
	request : function(){
//		if (!this.requestURL || this.lastRequestURL == this.requestURL) return;
		if (!this.requestURL || this.loadedURLs[this.requestURL]) return;

		var url_s = this.requestURL.split('/');
		if (url_s[0] !== this.win.location.protocol) {
			log("[uAutoPagerize] " + U(this.win.location.protocol + " が " + url_s[0] + "にリクエストを送ることはできません"));
			this.state = "error";
			return;
		}
		var host = this.win.location.host;
		var isSameDomain = url_s[2] === host;
		if (!isSameDomain) {
			// ドメインは違うけど下記のドメイン同士なら許可
			let ok = ["yahoo.co.jp", "livedoor.com"].some(function(h){
				return url_s[2].slice(-h.length) === h && host.slice(-h.length) === h;
			});
			if (!ok) {
				log("[uAutoPagerize] " + U(host + " が " + url_s[2] + "にリクエストを送ることはできません"));
				this.state = 'error';
				return;
			}
		}
		this.lastRequestURL = this.requestURL;
		var self = this;
		var headers = {};
		if (isSameDomain)
			headers.Cookie = this.doc.cookie;
		var opt = {
			method: 'get',
			get url() self.requestURL,
			set url(url) self.requestURL = url,
			headers: headers,
			overrideMimeType: 'text/html; charset=' + this.doc.characterSet,
			onerror: function(){ self.state = 'error'; self.req = null; },
			onload: function(res) { self.requestLoad.apply(self, [res]); self.req = null; }
		}
		this.win.requestFilters.forEach(function(i) { i(opt) }, this);
		this.state = 'loading';
		this.req = GM_xmlhttpRequest(opt, isSameDomain? this.win : null);
	},
	requestLoad : function(res){
		if (res.URI.scheme !== res.originalURI.scheme) {
			debug("external scheme.");
			this.setState('error');
			return;
		}
		let before = res.URI.host;
		let after  = res.originalURI.host;
		if (before !== after) {
			let ok = ["yahoo.co.jp", "livedoor.com"].some(function(h){
				return before.slice(-h.length) === h && after.slice(-h.length) === h;
			});
			if (!ok) {
				log("[uAutoPagerize] " + U(res.URI.spec + " から " + res.originalURI.spec + "にリダイレクトされました。"))
				this.state = "error";
				return;
			}
		}
		delete res.URI;
		delete res.originalURI;

		this.win.responseFilters.forEach(function(i) { i(res, this.requestURL) }, this);
		if (res.finalUrl)
			this.requestURL = res.finalUrl;

		var str = res.responseText;
		var htmlDoc;
		if (this.isXML) {
			htmlDoc = new DOMParser().parseFromString(str, "application/xml");
		} else {
			// thx! http://pc12.2ch.net/test/read.cgi/software/1253771697/478
			htmlDoc = this.doc.cloneNode(false);
			htmlDoc.appendChild(htmlDoc.importNode(this.documentElement, false));
			var range = this.doc.createRange();
			//range.selectNodeContents(this.body);
			htmlDoc.documentElement.appendChild(range.createContextualFragment(str));
			range.detach();
		}
		this.win.documentFilters.forEach(function(i) { i(htmlDoc, this.requestURL, this.info) }, this);

		try {
			var page = getElementsByXPath(this.info.pageElement, htmlDoc);
			var url = this.getNextURL(htmlDoc);
		}
		catch(e){
			this.state = 'error';
			return;
		}

		if (!page || page.length < 1 ) {
			debug('pageElement not found.' , this.info.pageElement);
			this.state = 'terminated';
			return;
		}

		if (this.loadedURLs[this.requestURL]) {
			debug('page is already loaded.', this.requestURL, this.info.nextLink);
			this.state = 'terminated';
			return;
		}

		if (typeof this.win.ap == 'undefined') {
			this.win.ap = { state: 'enabled' };
			updateIcon();
		}
		this.loadedURLs[this.requestURL] = true;
		if (this.insertPoint.compareDocumentPosition(this.doc) >= 32) {
			this.setInsertPoint();
			if (!this.insertPoint) {
				debug("insertPoint not found.", this.info.pageElement);
				this.state = 'terminated';
				return;
			}
			this.setRemainHeight();
		}
		page = this.addPage(htmlDoc, page);
		this.win.filters.forEach(function(i) { i(page) });
		this.requestURL = url;
		this.state = 'enable';
//		if (!ns.SCROLL_ONLY)
//			this.scroll();
		if (!url) {
			debug('nextLink not found.', this.info.nextLink, htmlDoc);
			this.state = 'terminated';
		}
		var ev = this.doc.createEvent('Event');
		ev.initEvent('GM_AutoPagerizeNextPageLoaded', true, false);
		this.doc.dispatchEvent(ev);
	},
	addPage : function(htmlDoc, page){
		var fragment = this.doc.createDocumentFragment();
		page.forEach(function(i) { fragment.appendChild(i); });
		this.win.fragmentFilters.forEach(function(i) { i(fragment, htmlDoc, page) }, this);

		var hr = this.doc.createElement('hr');
		hr.setAttribute('class', 'autopagerize_page_separator');
		hr.setAttribute('style', 'clear: both;');
		var p  = this.doc.createElement('p');
		p.setAttribute('class', 'autopagerize_page_info');
		p.setAttribute('style', 'clear: both;');
		p.innerHTML = 'page: <a class="autopagerize_link" href="' +
			this.requestURL.replace(/&/g, '&amp;') + '">' + (++this.pageNum) + '</a> ';

		if (!this.isFrame) {
			var o = p.insertBefore(this.doc.createElement('div'), p.firstChild);
			o.setAttribute('class', 'autopagerize_icon');
			o.style.cssText = [
				'background: ', COLOR['enable'], ';'
				,'width: .8em;'
				,'height: .8em;'
				,'padding: 0px;'
				,'margin: 0px .4em 0px 0px;'
				,'display: inline-block;'
				,'vertical-align:middle;'
			].join('');
			o.addEventListener('click', this, false);
		}

		var insertParent = this.insertPoint.parentNode;
		if (page[0] && page[0].tagName == 'TR') {
			var colNodes = getElementsByXPath('child::tr[1]/child::*[self::td or self::th]', insertParent);
			var colums = 0;
			for (var i = 0, l = colNodes.length; i < l; i++) {
				var col = colNodes[i].getAttribute('colspan');
				colums += parseInt(col, 10) || 1;
			}
			var td = this.doc.createElement('td');
			td.appendChild(hr);
			td.appendChild(p);
			var tr = this.doc.createElement('tr');
			td.setAttribute('colspan', colums);
			tr.appendChild(td);
			fragment.insertBefore(tr, fragment.firstChild);
		} else {
			fragment.insertBefore(p, fragment.firstChild);
			fragment.insertBefore(hr, fragment.firstChild);
		}

		insertParent.insertBefore(fragment, this.insertPoint);
		return page.map(function(pe) {
			var ev = this.doc.createEvent('MutationEvent');
			ev.initMutationEvent('AutoPagerize_DOMNodeInserted', true, false,
			                     insertParent, null,
			                     this.requestURL, null, null);
			pe.dispatchEvent(ev);
			return pe;
		}, this);
	},
	getNextURL : function(doc) {
		var nextLink = getFirstElementByXPath(this.info.nextLink, doc);
		if (nextLink) {
			var nextValue = nextLink.getAttribute('href') ||
				nextLink.getAttribute('action') || nextLink.value;

			if (nextValue && nextValue.indexOf('http') != 0) {
				var anc = this.doc.createElement('a');
				anc.setAttribute('href', nextValue);
				nextValue = anc.href;
				anc = null;
			}
			return nextValue;
		}
	},
	getPageElementsBottom : function() {
		try {
			var elem = getElementsByXPath(this.info.pageElement, this.doc).pop();
			return getElementBottom(elem);
		}
		catch(e) {}
	},
	getScrollHeight: function() {
		return Math.max(this.documentElement.scrollHeight, this.body.scrollHeight);
	},
	setInsertPoint: function() {
		var insertPoint = null;
		if (this.info.insertBefore) {
			insertPoint = getFirstElementByXPath(this.info.insertBefore, this.doc);
		}
		if (!insertPoint) {
			var lastPageElement = getElementsByXPath(this.info.pageElement, this.doc).pop();
			if (lastPageElement) {
				insertPoint = lastPageElement.nextSibling ||
					lastPageElement.parentNode.appendChild(this.doc.createTextNode(' '));
			}
			lastPageElement = null;
		}
		this.insertPoint = insertPoint;
	},
	setRemainHeight: function() {
		var scrollHeight = this.getScrollHeight();
		var bottom = getElementPosition(this.insertPoint).top ||
			this.getPageElementsBottom() || Math.round(scrollHeight * 0.8);
		this.remainHeight = scrollHeight - bottom + ns.BASE_REMAIN_HEIGHT;
	},
	initIcon: function() {
		var div = this.doc.createElement("div");
		div.setAttribute('id', 'autopagerize_icon');
		div.setAttribute('class', 'autopagerize_icon');
		div.style.cssText = [
			'font-size: 12px;'
			,'position: fixed;'
			,'z-index: 9999;'
			,'top: 3px;'
			,'right: 3px;'
			,'width: 10px;'
			,'height: 10px;'
			,'border: 1px inset #999;'
			,'padding: 0px;'
			,'margin: 0px;'
			,'color: #fff;'
			,'background: ' + COLOR[this.state]
		].join(" ");
		this.icon = this.body.appendChild(div);
		this.icon.addEventListener('click', this, false);
	},
};



function updateIcon(){
	var newState = "";
	if (ns.AUTO_START == false) {
		newState = "off";
	} else {
		if (content.ap) {
			newState = content.ap.state;
		} else {
			newState = "disable";
		}
	}
	ns.icon.setAttribute('state', newState);
	ns.icon.setAttribute('tooltiptext', newState);
	if (ns.context) {
		ns.context.setAttribute('state', newState);
		ns.context.setAttribute('tooltiptext', newState);
	}
}

function launchAutoPager_org(list, win) {
	try {
		var doc = win.document;
		var locationHref = win.location.href;
	} catch(e) {
		return;
	}
	list.some(function(info, index, array) {
		try {
			var exp = new RegExp(info.url);
			if (win.ap) {
			} else if ( ! exp.test(locationHref) ) {
			} else if (!getFirstElementByXPath(info.nextLink, doc)) {
				// ignore microformats case.
				if (!exp.test('http://a'))
					debug('nextLink not found.', info.nextLink);
			} else if (!getFirstElementByXPath(info.pageElement, doc)) {
				if (!exp.test('http://a'))
					debug('pageElement not found.', info.pageElement);
			} else {
				win.ap = new AutoPager(doc, info);
				return true;
			}
		} catch(e) {
			log('error at launchAutoPager() : ' + e);
		}
	});
	updateIcon();
}


function getElementsByXPath(xpath, node) {
	var nodesSnapshot = getXPathResult(xpath, node, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE);
	var data = [];
	for (var i = 0, l = nodesSnapshot.snapshotLength; i < l; i++) {
		data[i] = nodesSnapshot.snapshotItem(i);
	}
	return data;
}

function getFirstElementByXPath(xpath, node) {
	var result = getXPathResult(xpath, node, XPathResult.FIRST_ORDERED_NODE_TYPE);
	return result.singleNodeValue;
}

function getXPathResult(xpath, node, resultType) {
	var doc = node.ownerDocument || node
	var resolver = doc.createNSResolver(node.documentElement || node)
	// Use |node.lookupNamespaceURI('')| for Opera 9.5
	var defaultNS = node.lookupNamespaceURI(null)
	if (defaultNS) {
		const defaultPrefix = '__default__'
		xpath = addDefaultPrefix(xpath, defaultPrefix)
		var defaultResolver = resolver
		resolver = function (prefix) {
			return (prefix == defaultPrefix)
				? defaultNS : defaultResolver.lookupNamespaceURI(prefix)
		}
	}
	return doc.evaluate(xpath, node, resolver, resultType, null)
}

function addDefaultPrefix(xpath, prefix) {
	const tokenPattern = /([A-Za-z_\u00c0-\ufffd][\w\-.\u00b7-\ufffd]*|\*)\s*(::?|\()?|(".*?"|'.*?'|\d+(?:\.\d*)?|\.(?:\.|\d+)?|[\)\]])|(\/\/?|!=|[<>]=?|[\(\[|,=+-])|([@$])/g
	const TERM = 1, OPERATOR = 2, MODIFIER = 3
	var tokenType = OPERATOR
	prefix += ':'
	function replacer(token, identifier, suffix, term, operator, modifier) {
		if (suffix) {
			tokenType =
				(suffix == ':' || (suffix == '::' &&
				 (identifier == 'attribute' || identifier == 'namespace')))
				? MODIFIER : OPERATOR
		}
		else if (identifier) {
			if (tokenType == OPERATOR && identifier != '*') {
				token = prefix + token
			}
			tokenType = (tokenType == TERM) ? OPERATOR : TERM
		}
		else {
			tokenType = term ? TERM : operator ? OPERATOR : MODIFIER
		}
		return token
	}
	return xpath.replace(tokenPattern, replacer)
};

function getElementPosition(elem) {
	var offsetTrail = elem;
	var offsetLeft  = 0;
	var offsetTop   = 0;
	while (offsetTrail) {
		offsetLeft += offsetTrail.offsetLeft;
		offsetTop  += offsetTrail.offsetTop;
		offsetTrail = offsetTrail.offsetParent;
	}
	return {left: offsetLeft || null, top: offsetTop|| null};
}

function getElementBottom(elem) {
	var doc = elem.ownerDocument;
	if ('getBoundingClientRect' in elem) {
		var rect = elem.getBoundingClientRect();
		var top = parseInt(rect.top, 10) + (doc.body.scrollTop || doc.documentElement.scrollTop);
		var height = parseInt(rect.height, 10);
	} else {
		var c_style = doc.defaultView.getComputedStyle(elem, '');
		var height  = 0;
		var prop    = ['height', 'borderTopWidth', 'borderBottomWidth',
			'paddingTop', 'paddingBottom',
			'marginTop', 'marginBottom'];
		prop.forEach(function(i) {
			var h = parseInt(c_style[i]);
			if (typeof h == 'number') {
				height += h;
			}
		});
		var top = getElementPosition(elem).top;
	}
	return top ? (top + height) : null;
}


// end utility functions.
function getCache() {
	try{
		var cache = loadFile('uAutoPagerize.json');
		if (!cache) return false;
		cache = JSON.parse(cache);
		ns.SITEINFO = cache;
		log('[uAutoPagerize] Load cacheInfo.');
		return true;
	}catch(e){
		log('[uAutoPagerize] Error getCache.')
		return false;
	}
}

function requestSITEINFO(){
	var xhrStates = {};
	SITEINFO_IMPORT_URLS.forEach(function(i) {
		var opt = {
			method: 'get',
			url: i,
			onload: function(res) {
				xhrStates[i] = 'loaded';
				getCacheCallback(res, i);
			},
			onerror: function(res) {
				xhrStates[i] = 'error';
				getCacheErrorCallback(i);
			},
		}
		xhrStates[i] = 'start';
		GM_xmlhttpRequest(opt);
		setTimeout(function() {
			if (xhrStates[i] == 'start') {
				getCacheErrorCallback(i);
			}
		}, XHR_TIMEOUT);
	});
};

function getCacheCallback(res, url) {
	if (res.status != 200) {
		return getCacheErrorCallback(url);
	}

	var info;
	try {
		var s = new Components.utils.Sandbox( new XPCNativeWrapper(window) );
		info = Components.utils.evalInSandbox(res.responseText, s).map(function(i) { return i.data });
	} catch(e) {
		info = [];
	}
	if (info.length > 0) {
		info = info.filter(function(i) { return ('url' in i) })
		info.sort(function(a, b) { return (b.url.length - a.url.length) })

		var r_keys = ['url', 'nextLink', 'insertBefore', 'pageElement']
		info = info.map(function(i) {
			var item = {};
			r_keys.forEach(function(key) {
				if (i[key]) {
					item[key] = i[key];
				}
			});
			return item;
		});
//		var cacheInfo = {};
//		cacheInfo[url] = {
//			url: url,
//			expire: new Date(new Date().getTime() + CACHE_EXPIRE),
//			info: info
//		};
		ns.SITEINFO = info;
		log('getCacheCallback:' + url);
	}
	else {
		getCacheErrorCallback(url);
	}
}

function getCacheErrorCallback(url) {
	log('getCacheErrorCallback:' + url);
}

function GM_xmlhttpRequest(obj, win) {
	if (typeof(obj) != 'object' || (typeof(obj.url) != 'string' && !(obj.url instanceof String))) return;
	if (!win || "@maone.net/noscript-service;1" in Cc) win = window;

	var req = new win.XMLHttpRequest();
	req.open(obj.method || 'GET',obj.url,true);

	if (typeof(obj.headers) == 'object')
		for(var i in obj.headers)
			req.setRequestHeader(i,obj.headers[i]);
	if (obj.overrideMimeType)
		req.overrideMimeType(obj.overrideMimeType);
	
	['onload','onerror','onreadystatechange'].forEach(function(k) {
		if (obj[k] && (typeof(obj[k]) == 'function' || obj[k] instanceof Function)) req[k] = function() {
			obj[k]({
				status          : (req.readyState == 4) ? req.status : 0,
				statusText      : (req.readyState == 4) ? req.statusText : '',
				responseHeaders : (req.readyState == 4) ? req.getAllResponseHeaders() : '',
				responseText    : req.responseText,
				responseXML     : req.responseXML,
				readyState      : req.readyState,
				finalUrl        : (req.readyState == 4) ? req.channel.URI.spec : '',
				URI             : req.channel.URI,
				originalURI     : req.channel.originalURI
			});
		};
	});

	req.send(obj.send || null);
	return req;
}

function wildcardToRegExpStr(urlstr) {
	if (urlstr instanceof RegExp) return urlstr.source;
	let reg = urlstr.replace(/[()\[\]{}|+.,^$?\\]/g, "\\$&").replace(/\*+/g, function(str){
		return str === "*" ? ".*" : "[^/]*";
	});
	return "^" + reg + "$";
}

function log(){ Application.console.log($A(arguments)); }
function debug(){ if (ns.DEBUG) Application.console.log('DEBUG: ' + $A(arguments)); };
function $(id, doc) (doc || document).getElementById(id);

// http://gist.github.com/321205
function U(text) 1 < 'あ'.length ? decodeURIComponent(escape(text)) : text;
function $A(arr) Array.slice(arr);
function $E(xml, doc) {
	doc = doc || document;
	xml = <root xmlns={doc.documentElement.namespaceURI}/>.appendChild(xml);
	var settings = XML.settings();
	XML.prettyPrinting = false;
	var root = new DOMParser().parseFromString(xml.toXMLString(), 'application/xml').documentElement;
	XML.setSettings(settings);
	doc.adoptNode(root);
	var range = doc.createRange();
	range.selectNodeContents(root);
	var frag = range.extractContents();
	range.detach();
	return frag.childNodes.length < 2 ? frag.firstChild : frag;
}

function addStyle(css) {
	var pi = document.createProcessingInstruction(
		'xml-stylesheet',
		'type="text/css" href="data:text/css;utf-8,' + encodeURIComponent(css) + '"'
	);
	return document.insertBefore(pi, document.documentElement);
}

function loadFile(name) {
	var file = Services.dirsvc.get('UChrm', Ci.nsILocalFile);
	file.appendRelativePath(name);
	var fstream = Cc["@mozilla.org/network/file-input-stream;1"].createInstance(Ci.nsIFileInputStream);
	var sstream = Cc["@mozilla.org/scriptableinputstream;1"].createInstance(Ci.nsIScriptableInputStream);
	fstream.init(file, -1, 0, 0);
	sstream.init(fstream);

	var data = sstream.read(sstream.available());
	try {
		data = decodeURIComponent(escape(data));
	} catch(e) {  }
	sstream.close();
	fstream.close();
	return data;
}

function saveFile(name, data) {
	var file = Services.dirsvc.get('UChrm', Ci.nsILocalFile);
	file.appendRelativePath(name);

	var suConverter = Cc["@mozilla.org/intl/scriptableunicodeconverter"].createInstance(Ci.nsIScriptableUnicodeConverter);
	suConverter.charset = 'UTF-8';
	data = suConverter.ConvertFromUnicode(data);

	var foStream = Cc['@mozilla.org/network/file-output-stream;1'].createInstance(Ci.nsIFileOutputStream);
	foStream.init(file, 0x02 | 0x08 | 0x20, 0664, 0);
	foStream.write(data, data.length);
	foStream.close();
};

})(<![CDATA[

#uAutoPagerize-icon,
#uAutoPagerize-context {
	list-style-image: url(
		data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFAAAAAQCAYAAACBSfjBAAAA2klEQVRYhe
		2WwYmGMBhE390+0kCOwZLswQK82YAg2Ict2IBdeJ3/FHcW9oewnoRv4N0yGB4TECLPs22bHIBlWeQAzP
		Msp/a7q5MDkM4kB6DsRc7PDaTfQEqnHIBSdjm1fXWXHIAznXIA9rLLub+esxyA4zjkfDsXAkNgCHy/wM
		jDtK5tHEc5td+6tn7t5dz9xrX1/Sqn9lvXtvarnNpvXdtfLzUEhsAQ+H6BkYdpXdswDHJqv3Vtecpy7n
		7j2nKe5NR+69qmPMmp/da1ff2NCYEhMAS+WmDk//kA2XH2W9CWRjQAAAAASUVORK5CYII=
		);
}
#uAutoPagerize-icon[state="disable"],
#uAutoPagerize-context[state="disable"]    { -moz-image-region: rect(0px 16px 16px 0px ); }
#uAutoPagerize-icon[state="enable"],
#uAutoPagerize-context[state="enable"]     { -moz-image-region: rect(0px 32px 16px 16px); }
#uAutoPagerize-icon[state="terminated"],
#uAutoPagerize-context[state="terminated"] { -moz-image-region: rect(0px 48px 16px 32px); }
#uAutoPagerize-icon[state="error"],
#uAutoPagerize-context[state="error"]      { -moz-image-region: rect(0px 64px 16px 48px); }
#uAutoPagerize-icon[state="off"],
#uAutoPagerize-context[state="off"]        { -moz-image-region: rect(0px 80px 16px 64px); }


#uAutoPagerize-icon[state="loading"],
#uAutoPagerize-context[state="loading"] {
	list-style-image: url(data:image/gif;base64,
		R0lGODlhEAAQAKEDADC/vyHZ2QD//////yH/C05FVFNDQVBFMi4wAwEAAAAh+QQJCgADACwAAAAAEAAQ
		AAACIJyPacKi2txDcdJmsw086NF5WviR32kAKvCtrOa2K3oWACH5BAkKAAMALAAAAAAQABAAAAIinI9p
		wTEChRrNRanqi1PfCYLACIQHWZoDqq5kC8fyTNdGAQAh+QQJCgADACwAAAAAEAAQAAACIpyPacAwAcMQ
		VKz24qyXZbhRnRNJlaWk6sq27gvH8kzXQwEAIfkECQoAAwAsAAAAABAAEAAAAiKcj6kDDRNiWO7JqSqU
		1O24hCIilMJomCeqokPrxvJM12IBACH5BAkKAAMALAAAAAAQABAAAAIgnI+pCg2b3INH0uquXqGH7X1a
		CHrbeQiqsK2s5rYrehQAIfkECQoAAwAsAAAAABAAEAAAAiGcj6nL7Q+jNKACaO/L2E4mhMIQlMEijuap
		pKSJim/5DQUAIfkECQoAAwAsAAAAABAAEAAAAiKcj6nL7Q+jnLRaJbIYoYcBhIChbd4njkPJeaBIam33
		hlUBACH5BAEKAAMALAAAAAAQABAAAAIgnI+py+0PoxJUwGofvlXKAAYDQAJLKJamgo7lGbqktxQAOw==
		);
}

#uAutoPagerize-icon > .statusbarpanel-text {
	display: none !important;
}

]]>.toString().replace(/\n|\t/g, ''));

window.uAutoPagerize.init();


/*

※開発側の変更
INCLUDE, EXCLUDE はまとめて正規表現にしてチェックする
AutoPager のメソッドを大幅に追加
	stateToggle, destroy, abort, handleEvent, addListener, removeListener,
	setInsertPoint, setRemainHeight, getScrollHeight, 
AutoPager#addPage の大幅な書き換え
AutoPager#setState を廃止にした
Google の hashchange 周りは AutoPager#destroy を利用した
fragmentFilters フィルターを追加した
url_regexp を Object.defineProperty で実装した
*/
