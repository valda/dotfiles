// ==UserScript==
// @name 			OpenNewTab.uc.js
// @description 	新規タブで開く（空白タブ再利用）
// @include 		main
// @include 		chrome://browser/content/bookmarks/bookmarksPanel.xul
// @include 		chrome://browser/content/history/history-panel.xul
// @include 		chrome://browser/content/places/places.xul
// @compatibility	Firefox 4.0
// ==/UserScript==
(function() {

if (location == "chrome://browser/content/browser.xul") {


// ロケーションバーから
// urlbarBindings.xml
  var str = gURLBar.handleCommand.toString();
  str = str.replace(/aTriggeringEvent &&\s+aTriggeringEvent\.altKey/,
                    '!url.match(/^javascript:/)');
  eval("gURLBar.handleCommand = " + str);

// 検索ボックスから
// searchbar.xml
  var searchbar = document.getElementById("searchbar");
  if (searchbar) {
    var str = searchbar.handleSearchCommand.toString();
    str = str.replace('where = whereToOpenLink(aEvent, false, true);',
                      'if (!isTabEmpty(gBrowser.selectedTab)) where = "tab";');
    str = str.replace('(aEvent && aEvent.altKey) ^ newTabPref',
                      '!isTabEmpty(gBrowser.selectedTab)');
    eval("searchbar.handleSearchCommand = " + str);
  }

// 外部アプリから
// browser.js
  var str = nsBrowserAccess.prototype.openURI.toString();
  str = str.replace('switch (aWhere) {',
        'if (isExternal && aWhere == Ci.nsIBrowserDOMWindow.OPEN_NEWTAB && \
             isTabEmpty(gBrowser.selectedTab))\
           aWhere = Ci.nsIBrowserDOMWindow.OPEN_CURRENTWINDOW; $&');
  eval("nsBrowserAccess.prototype.openURI = " + str);


} //chrome://browser/content/browser.xul


// ブックマーク、履歴から（サイドバー含む）
// utilityOverlay.js
  var str = openLinkIn.toString();
  str = str.replace('w.gBrowser.selectedTab.pinned',
        '(!w.isTabEmpty(w.gBrowser.selectedTab) || $&)');
  str = str.replace(/&&\s+w\.gBrowser\.currentURI\.host != uriObj\.host/,'');
  eval("openLinkIn = " + str);

// タブですべて開く
// modules\PlacesUIUtils.jsm
  var str = PlacesUIUtils._openTabset.toString();
  str = str.replace('browserWindow.gBrowser.loadTabs(',
        'if (!browserWindow.isTabEmpty(browserWindow.gBrowser.selectedTab))\
           replaceCurrentTab = false; $&');
  eval("PlacesUIUtils._openTabset = " + str);

})();
