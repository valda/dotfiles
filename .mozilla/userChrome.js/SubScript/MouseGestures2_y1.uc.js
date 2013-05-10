/**
 * A user script for userChrome.js extension.
 * @name Mouse Gestures
 * @description Lightweight customizable mouse gestures.
 * @compatibility Firefox 2.0
 * @author Gomita
 * @lastupdated 2007.6.30
 * @permalink http://www.xuldev.org/blog/?p=106
 */

/**
 * Status line customized version. (2007.11.20) by Yuki
 * http://eureka.pasela.org/
 */
var ucjsMouseGestures = {

	// 設定
	enableWheelGestures: true,	// ホイールジェスチャ（右クリックしながらマウスホイール）
	enableRockerGestures: true,	// ロッカージェスチャ（右クリックしながら左クリック、またはその逆）

	_lastX: 0,
	_lastY: 0,
	_directionChain: "",
	_isMac: false,	// for Mac
	_lang: null,

	// ジェスチャの定義
	gestures: {
		"L<R": {
			name: "History Back",
			name_ja: "\u623B\u308B",	// 戻る
			command: function() { document.getElementById("Browser:Back").doCommand(); }
		},

		"L": {
			name: "History Back",
			name_ja: "\u623B\u308B",	// 戻る
			command: function() { document.getElementById("Browser:Back").doCommand(); }
		},

		"L>R": {
			name: "History Forward",
			name_ja: "\u9032\u3080",	// 進む
			command: function() { document.getElementById("Browser:Forward").doCommand(); }
		},

		"R": {
			name: "History Forward",
			name_ja: "\u9032\u3080",	// 進む
			command: function() { document.getElementById("Browser:Forward").doCommand(); }
		},

		"UD": {
			name: "Reload Document",
			name_ja: "\u66F4\u65B0",	// 更新
			command: function() { document.getElementById("Browser:Reload").doCommand(); }
		},

		"UDU": {
			name: "Reload Document from Network",
			name_ja: "\u30AD\u30E3\u30C3\u30B7\u30E5\u3092\u7121\u8996\u3057\u3066\u66F4\u65B0",	// キャッシュを無視して更新
			command: function() { document.getElementById("Browser:ReloadSkipCache").doCommand(); }
		},

		"RUD": {
			name: "Minimize Window",
			name_ja: "\u30A6\u30A3\u30F3\u30C9\u30A6\u3092\u6700\u5C0F\u5316",	// ウィンドウを最小化
			command: function() { window.minimize(); }
		},

		"RDU": {
			name: "Restore or Maximize Window",
			name_ja: "\u30A6\u30A3\u30F3\u30C9\u30A6\u3092\u6700\u5927\u5316 \u307E\u305F\u306F \u30A6\u30A3\u30F3\u30C9\u30A6\u3092\u5143\u306E\u30B5\u30A4\u30BA\u306B\u623B\u3059",	// ウィンドウを最大化 または ウィンドウを元のサイズに戻す
			command: function() { window.windowState == 1 ? window.restore() : window.maximize(); }
		},

		"LR": {
			name: "Open new Tab",
			name_ja: "\u65B0\u3057\u3044\u30BF\u30D6\u3092\u958B\u304F",	// 新しいタブを開く
			command: function() { document.getElementById("cmd_newNavigatorTab").doCommand(); }
		},

		"DR": {
			name: "Close current Tab",
			name_ja: "\u30BF\u30D6\u3092\u9589\u3058\u308B",	// タブを閉じる
			command: function() { document.getElementById("cmd_close").doCommand(); }
		},

		"DL": {
			name: "Undo Close Tab",
			name_ja: "\u9589\u3058\u305F\u30BF\u30D6\u3092\u5143\u306B\u623B\u3059",	// 閉じたタブを元に戻す
			command: function() { document.getElementById("History:UndoCloseTab").doCommand(); }
			// Tab Mix Plus のセッションマネージャを使用している場合
			// command: function() { gBrowser.undoRemoveTab(); }
		},

		"W-": {
			name: "Previous Tab",
			name_ja: "\u524D\u306E\u30BF\u30D6\u3078",	// 前のタブへ
			command: function() { gBrowser.mTabContainer.advanceSelectedTab(-1, true); }
		},

		"UL": {
			name: "Previous Tab",	// 前のタブへ
			name_ja: "\u524D\u306E\u30BF\u30D6\u3078",	// 前のタブへ
			command: function() { gBrowser.mTabContainer.advanceSelectedTab(-1, true); }
		},

		"W+": {
			name: "Next Tab",
			name_ja: "\u6B21\u306E\u30BF\u30D6\u3078",	// 次のタブへ
			command: function() { gBrowser.mTabContainer.advanceSelectedTab(+1, true); }
		},

		"UR": {
			name: "Next Tab",	// 次のタブへ
			name_ja: "\u6B21\u306E\u30BF\u30D6\u3078",	// 次のタブへ
			command: function() { gBrowser.mTabContainer.advanceSelectedTab(+1, true); }
		},

		"LU": {
			name: "Scroll to top of page",
			name_ja: "\u30DA\u30FC\u30B8\u5148\u982D\u3078\u30B9\u30AF\u30ED\u30FC\u30EB",	// ページ先頭へスクロール
			command: function() { goDoCommand("cmd_scrollTop"); }
		},

		"LD": {
			name: "Scroll to bottom of page",
			name_ja: "\u30DA\u30FC\u30B8\u672B\u5C3E\u3078\u30B9\u30AF\u30ED\u30FC\u30EB",	// ページ末尾へスクロール
			command: function() { goDoCommand("cmd_scrollBottom"); }
		},

		"U": {
			name: "Scroll Up",
			name_ja: "\u30DA\u30FC\u30B8\u30A2\u30C3\u30D7",	// ページアップ
			command: function() { goDoCommand("cmd_scrollPageUp"); }
		},

		"D": {
			name: "Scroll Down",
			name_ja: "\u30DA\u30FC\u30B8\u30C0\u30A6\u30F3",	// ページダウン
			command: function() { goDoCommand("cmd_scrollPageDown"); }
		},

		"LRD": {
			name: "Decrease Text Size",
			name_ja: "\u6587\u5B57\u30B5\u30A4\u30BA\u3092\u5C0F\u3055\u304F",	// 文字サイズを小さく
			command: function() { document.getElementById("cmd_fullZoomReduce").doCommand(); }
		},

		"LRU": {
			name: "Increase Text Size",
			name_ja: "\u6587\u5B57\u30B5\u30A4\u30BA\u3092\u5927\u304D\u304F",	// 文字サイズを大きく
			command: function() { document.getElementById("cmd_fullZoomEnlarge").doCommand(); }
		},

		"LRUD": {
			name: "Reset Text Size",
			name_ja: "\u6587\u5b57\u30b5\u30a4\u30ba\u3092\u30ea\u30bb\u30c3\u30c8",	// 文字サイズをリセット
			command: function() { document.getElementById("cmd_fullZoomReset").doCommand(); }
		},

		"LDRU": {
			name: "Full Screen",
			name_ja: "\u5168\u753B\u9762\u8868\u793A",	// 全画面表示
			command: function() { document.getElementById("View:FullScreen").doCommand(); }
		},
	},

	init: function()
	{
		this._isMac = navigator.platform.indexOf("Mac") == 0;
		this._lang = navigator.language.substring(0, 2);
		gBrowser.mPanelContainer.addEventListener("mousedown", this, false);
		gBrowser.mPanelContainer.addEventListener("mousemove", this, false);
		gBrowser.mPanelContainer.addEventListener("mouseup", this, false);
		gBrowser.mPanelContainer.addEventListener("contextmenu", this, true);
		if (this.enableRockerGestures)
			gBrowser.mPanelContainer.addEventListener("draggesture", this, true);
		if (this.enableWheelGestures)
			gBrowser.mPanelContainer.addEventListener("DOMMouseScroll", this, false);
	},

	uninit: function()
	{
		gBrowser.mPanelContainer.removeEventListener("mousedown", this, false);
		gBrowser.mPanelContainer.removeEventListener("mousemove", this, false);
		gBrowser.mPanelContainer.removeEventListener("mouseup", this, false);
		gBrowser.mPanelContainer.removeEventListener("contextmenu", this, true);
		if (this.enableRockerGestures)
			gBrowser.mPanelContainer.removeEventListener("draggesture", this, true);
		if (this.enableWheelGestures)
			gBrowser.mPanelContainer.removeEventListener("DOMMouseScroll", this, false);
	},

	_isMouseDownL: false,
	_isMouseDownR: false,
	_suppressContext: false,
	_shouldFireContext: false,

	handleEvent: function(event)
	{
		switch (event.type) {
			case "mousedown":
				// [1] ジェスチャ開始
				if (event.button == 2) {
					this._isMouseDownR = true;
					this._suppressContext = false;
					this._startGesture(event);
					if (this.enableRockerGestures && this._isMouseDownL) {
						this._isMouseDownR = false;
						this._suppressContext = true;
						this._directionChain = "L>R";
						this._stopGesture(event);
					}
				}
				else if (this.enableRockerGestures && event.button == 0) {
					this._isMouseDownL = true;
					if (this._isMouseDownR) {
						this._isMouseDownL = false;
						this._suppressContext = true;
						this._directionChain = "L<R";
						this._stopGesture(event);
					}
				}
				break;
			case "mousemove":
				// [2] ジェスチャ継続中
				if (this._isMouseDownR) {
					this._progressGesture(event);
				}
				break;
			case "mouseup":
				// [3] ジェスチャ終了～アクション実行
				if ((this._isMouseDownR && event.button == 2) ||
				    (this._isMouseDownR && this._isMac && event.button == 0 && event.ctrlKey)) {
					this._isMouseDownR = false;
					if (this._directionChain)
						this._suppressContext = true;
					this._stopGesture(event);
					// [Linux] Win32を真似てmouseup後にcontextmenuを発生させる
					if (this._shouldFireContext) {
						this._shouldFireContext = false;
						this._displayContextMenu(event);
					}
				}
				else if (this.enableRockerGestures && event.button == 0 && this._isMouseDownL) {
					this._isMouseDownL = false;
				}
				break;
			case "contextmenu":
				// [4-1] アクション実行後のコンテキストメニュー表示を抑止する
				// [4-2] 方向が認識されない微小な動きの場合は抑止しない
				// [Linux] mousedown直後のcontextmenuを抑止して...
				if (this._suppressContext || this._isMouseDownR) {
					this._suppressContext = false;
					event.preventDefault();
					event.stopPropagation();
					// [Linux] ...代わりにmouseup後にcontextmenuを発生させる
					if (this._isMouseDownR) {
						this._shouldFireContext = true;
					}
				}
				break;
			case "DOMMouseScroll":
				if (this.enableWheelGestures && this._isMouseDownR) {
					event.preventDefault();
					event.stopPropagation();
					this._suppressContext = true;
					this._directionChain = "W" + (event.detail > 0 ? "+" : "-");
					this._stopGesture(event);
				}
				break;
			case "draggesture":
				this._isMouseDownL = false;
				break;
		}
	},

	_displayContextMenu: function(event)
	{
		var evt = event.originalTarget.ownerDocument.createEvent("MouseEvents");
		evt.initMouseEvent(
			"contextmenu", true, true, event.originalTarget.defaultView, 0,
			event.screenX, event.screenY, event.clientX, event.clientY,
			false, false, false, false, 2, null
		);
		event.originalTarget.dispatchEvent(evt);
	},

	_startGesture: function(event)
	{
		this._lastX = event.screenX;
		this._lastY = event.screenY;
		this._directionChain = "";
	},

	_progressGesture: function(event)
	{
		var x = event.screenX;
		var y = event.screenY;
		var distanceX = Math.abs(x - this._lastX);
		var distanceY = Math.abs(y - this._lastY);
		// 認識する最小のマウスの動き
		const tolerance = 10;
		if (distanceX < tolerance && distanceY < tolerance)
			return;
		// 方向の決定
		var direction;
		if (distanceX > distanceY)
			direction = x < this._lastX ? "L" : "R";
		else
			direction = y < this._lastY ? "U" : "D";
		// 前回の方向と比較
		var lastDirection = this._directionChain.charAt(this._directionChain.length - 1);
		if (direction != lastDirection) {
			this._directionChain += direction;
			var status = "Gesture: " + this._directionChain;
			if (this.gestures[this._directionChain]) {
				var name = "name";
				if (this._lang) {
					name = "name_" + this._lang;
					if (!this.gestures[this._directionChain][name]) {
						this._lang = null;
						name = "name";
					}
				}
				status += " (" + this.gestures[this._directionChain][name] + ")";
			}
			XULBrowserWindow.statusTextField.label = status;
		}
		// 今回の位置を保存
		this._lastX = x;
		this._lastY = y;
	},

	_stopGesture: function(event)
	{
		try {
			if (this._directionChain)
				this._performAction(event);
			XULBrowserWindow.statusTextField.label = "";
		}
		catch(ex) {
			XULBrowserWindow.statusTextField.label = ex;
		}
		this._directionChain = "";
	},

	_performAction: function(event)
	{
		if (this.gestures[this._directionChain]) {
			this.gestures[this._directionChain].command();
		} else {
			throw "Unknown Gesture: " + this._directionChain;
		}
	}

};

// エントリポイント
ucjsMouseGestures.init();
window.addEventListener("unload", function(){ ucjsMouseGestures.uninit(); }, false);
