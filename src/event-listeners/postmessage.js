import arrayUtils from '../utils/array';
import WarningTextEnum from '../enums/WarningTextEnum';
import PostMessageEventNamesEnum from '../enums/PostMessageEventNamesEnum';
import '../utils/customEventPolyfill';

/*
 * Custom PostMessage Convetions Followed - Sending and Receieving data gracefully
 * -------------------------------------------------------------------------------
 *
 * 1. First convetion
      Since data can be sent or receieved via postmessge API in the form of strings,
      the library stores data as stringified JSON object and while reading it, parses the JSON stringified earlier.
      This is easy to maintain and deal with data.

 * 2. Second Convetions
      With every data, there's an associated message identifier.
      A message identifier helps in knowing the intention of what event actually is for.
      For eg: To send data after proper establishment from Child tab,
      Parent tab acknowledges the connection by returning the true identity of the Child tab.
      This is done via prepending the Event name i.e. HANDSHAKE_WTIH_PARENT

      So the postmessage's message would like: `HANDSHAKE_WTIH_PARENT{"id": 123, "name": "Hello World!"}`.
      So, while reading the message, it has to be first checked up with the defined event names
      and then after successful match, the message is split using the Event-name as a delimiter.
      The first entry if the event name and the second one is the actual data.
 *
 */

/**
 * Factory function to create a PostMessageListener bound to a specific tabUtils instance
 * @param {Object} tabUtils - Instance of TabUtils
 * @returns {Object} PostMessageListener object with methods bound to the tabUtils instance
 */
function createPostMessageListener(tabUtils) {
  const PostMessageListener = {};

  /**
   * OnLoad Event - it serves as an communication establishment source from Child tab
   */
  PostMessageListener._onLoad = (data, source) => {
    let tab,
      tabs,
      dataToSend,
      tabInfo = data.split(PostMessageEventNamesEnum.LOADED)[1];

    // Child was opened but parent got refreshed, opened a tab i.e.
    // last opened tab will get refreshed(browser behavior). WOW! Handle this now.
    if (tabInfo) {
      try {
        tabInfo = tabUtils.config.parse(tabInfo);
        // If Child knows its UUID, means Parent was refreshed and Child did not
        if (tabInfo.id) {
          tabs = tabUtils.getAll();
          if (tabs.length) {
            // Find the specific tab that sent the LOADED message by its ID
            tab = arrayUtils.searchByKeyName(tabs, 'id', tabInfo.id);
            if (tab) {
              tab.name = tabInfo.name || tabInfo.windowName;
            }
          }
        }
      } catch (e) {
        throw new Error(WarningTextEnum.INVALID_JSON);
      }
    }

    // If no target tab found from existing session data, use the most recently opened tab
    // This handles the case of newly opened tabs that don't have session data yet
    if (!tab) {
      tabs = tabUtils.getAll();
      tab = tabs.find(t => t.ref === source);
    }

    // If still no tab found, try to find by source reference
    if (!tab && source) {
      tabs = tabUtils.getAll();
      tab = tabs.find(t => t.ref === source);
    }

    // Send handshake to the identified target tab
    if (tab) {
      try {
        dataToSend = PostMessageEventNamesEnum.HANDSHAKE_WITH_PARENT;
        dataToSend += tabUtils.config.stringify({
          id: tab.id,
          name: tab.name || tab.windowName,
          parentName: window.name
        });
        tabUtils.sendMessage(tab, dataToSend, tabInfo && tabInfo.isSiteInsideFrame);
      } catch (e) {
        throw new Error(WarningTextEnum.INVALID_JSON);
      }
    }
  };

  /**
   * onCustomMessage Event - Any sort of custom message by child is treated here
   * @param  {Object} data
   *
   * The method fires an event to notify Parent regarding Child's behavior
   */
  PostMessageListener._onCustomMessage = (data, type) => {
    let event,
      eventData,
      tabInfo = data.split(type)[1];

    try {
      tabInfo = tabUtils.config.parse(tabInfo);
    } catch (e) {
      throw new Error(WarningTextEnum.INVALID_JSON);
    }

    eventData = {
      tabInfo,
      type
    };

    event = new CustomEvent('onCustomChildMessage', { detail: eventData });

    window.dispatchEvent(event);
  };

  /**
   * onBeforeUnload Event - Tells parent that either Child tab was closed or refreshed.
   * Child uses native `ON_BEFORE_UNLOAD` method to notify Parent.
   *
   * @param  {Object} data
   */
  PostMessageListener._onBeforeUnload = data => {
    let tabInfo = data.split(PostMessageEventNamesEnum.ON_BEFORE_UNLOAD)[1];

    try {
      tabInfo = tabUtils.config.parse(tabInfo);
    } catch (e) {
      throw new Error(WarningTextEnum.INVALID_JSON);
    }

    // CustomEvent is not supported in IE, but polyfill will take care of it
    let event = new CustomEvent('onChildUnload', { detail: tabInfo });

    window.dispatchEvent(event);
  };

  /**
   * onNewTab - It's the entry point for data processing after receiving any postmessage form any Child Tab
   * @param  {Object} message
   */
  PostMessageListener.onNewTab = message => {
    let source = message.source;
    let data = message.data;

    /**
     * Safe check - This happens when CHild Tab gets closed just after sending a message.
     * No need to go further from this point.
     * Tab status is automatically fetched using our polling mechanism written in `Parent.js` file.
     */
    if (!data || typeof data !== 'string' || !tabUtils.tabs.length) {
      return false;
    }

    // `origin` check for secureity point of view
    if (tabUtils.config.origin && tabUtils.config.origin !== message.origin) {
      return false;
    }

    if (data.indexOf(PostMessageEventNamesEnum.LOADED) > -1) {
      PostMessageListener._onLoad(data, source);
    } else if (data.indexOf(PostMessageEventNamesEnum.CUSTOM) > -1) {
      PostMessageListener._onCustomMessage(data, PostMessageEventNamesEnum.CUSTOM);
    } else if (data.indexOf(PostMessageEventNamesEnum.HANDSHAKE) > -1) {
      PostMessageListener._onCustomMessage(data, PostMessageEventNamesEnum.HANDSHAKE);
    } else if (data.indexOf(PostMessageEventNamesEnum.ON_BEFORE_UNLOAD) > -1) {
      PostMessageListener._onBeforeUnload(data);
    }
  };

  return PostMessageListener;
}

export default createPostMessageListener;
