/**
 * A Tab utility class to deal with tab operations
 */

import PostMessageEventNamesEnum from '../enums/PostMessageEventNamesEnum';
import arrayUtils from './array';
import TabStatusEnum from '../enums/TabStatusEnum';
import WarningTextEnum from '../enums/WarningTextEnum';

class TabUtils {
  constructor(config) {
    this.tabs = [];
    this.config = config || {};
  }

  /**
   * Remove a tab from a list of all tabs.
   * This is required when users opts for removing the closed tabs from the list of tabs.
   * This can be done explictly by passing `removeClosedTabs` key while instantiating Parent.
   * @param  {Object} tab
   */
  _remove(tab) {
    let index;

    index = arrayUtils.searchByKeyName(this.tabs, 'id', tab.id, 'index');
    this.tabs.splice(index, 1);
  }

  /**
   * As explained in `event-listeners/postmessage.js` file,
   * the data received from postmessage API is further processed based on our convention
   * @param  {String} msg
   * @return {String} modified msg
   */
  _preProcessMessage(msg) {
    // make msg always an object to support JSON support
    try {
      msg = this.config.stringify(msg);
    } catch (e) {
      throw new Error(WarningTextEnum.INVALID_JSON);
    }

    if (msg && msg.indexOf(PostMessageEventNamesEnum.PARENT_COMMUNICATED) === -1) {
      msg = PostMessageEventNamesEnum.PARENT_COMMUNICATED + msg;
    }

    return msg;
  }

  /**
   * Add a new tab to the Array of tabs
   * @param  {Object} tab
   * @return {Object} - this
   */
  addNew(tab) {
    this.tabs.push(tab);
    return this;
  }

  /**
   * Filter out all the opened tabs
   * @return {Array} - only the opened tabs
   */
  getOpened() {
    return this.tabs.filter(tab => tab.status === TabStatusEnum.OPEN);
  }

  /**
   * Filter out all the closed tabs
   * @return {Array} - only the closed tabs
   */
  getClosed() {
    return this.tabs.filter(tab => tab.status === TabStatusEnum.CLOSE);
  }

  /**
   * To get list of all tabs(closed/opened).
   * Note: Closed tabs will not be returned if `removeClosedTabs` key is paased while instantiaiting Parent.
   * @return {Array} - list of all tabs
   */
  getAll() {
    return this.tabs;
  }

  /**
   * Close a specific tab
   * @param  {String} id
   * @return {Object} this
   */
  closeTab(id) {
    let tab = arrayUtils.searchByKeyName(this.tabs, 'id', id);

    if (tab && tab.ref) {
      tab.ref.close();
      tab.status = TabStatusEnum.CLOSE;
    }

    return this;
    // --this.tabs.length;
  }

  /**
   * Close all opened tabs using a native method `close` available on window.open reference.
   * @return {TabUtils} this
   */
  closeAll() {
    let i;

    for (i = 0; i < this.tabs.length; i++) {
      if (this.tabs[i] && this.tabs[i].ref) {
        this.tabs[i].ref.close();
        this.tabs[i].status = TabStatusEnum.CLOSE;
      }
    }

    return this;
  }

  /**
   * Send a postmessage to every opened Child tab(excluding itself i.e Parent Tab)
   * @param  {String} msg
   * @param  {Boolean} isSiteInsideFrame
   */
  broadCastAll(msg, isSiteInsideFrame) {
    let i,
      tabs = this.getOpened();

    msg = this._preProcessMessage(msg);

    for (i = 0; i < tabs.length; i++) {
      this.sendMessage(tabs[i], msg, isSiteInsideFrame);
    }

    return this;
  }

  /**
   * Send a postmessage to a specific Child tab
   * @param  {String} id
   * @param  {String} msg
   * @param  {Boolean} isSiteInsideFrame
   */
  broadCastTo(id, msg, isSiteInsideFrame) {
    let targetedTab,
      tabs = this.getAll();

    msg = this._preProcessMessage(msg);

    targetedTab = arrayUtils.searchByKeyName(tabs, 'id', id); // TODO: tab.id
    this.sendMessage(targetedTab, msg, isSiteInsideFrame);

    return this;
  }

  /**
   * Send a postMessage to the desired window/frame
   * @param  {Object}  target
   * @param  {String}  msg
   * @param  {Boolean} isSiteInsideFrame
   */
  sendMessage(target, msg, isSiteInsideFrame) {
    let origin = this.config.origin || '*';
    if (isSiteInsideFrame && target.ref[0]) {
      for (let i = 0; i < target.ref.length; i++) {
        target.ref[i].postMessage(msg, origin);
      }
    } else if (target.ref && target.ref.top) {
      target.ref.top.postMessage(msg, origin);
    }
  }

  /**
   * Reset all tabs and state
   */
  reset() {
    this.tabs = [];
  }
}

export default TabUtils;
