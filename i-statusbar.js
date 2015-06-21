module.exports = function (window) {
    "use strict";

    require('itags.core')(window);
    require('./css/i-statusbar.css');

    var itagName = 'i-statusbar', // <-- define your own itag-name here
        DOCUMENT = window.document,
        ITSA = window.ITSA,
        DEFAULT_READY = 'ready',
        MESSAGE_LEVELS = {
            'message': 1,
            'warn': 2,
            'error': 3,
            'statusmessage': 1 // revert to level 1!
        },
        MESSAGE_HASHES = {
            'message': 'messages',
            'warn': 'warnings',
            'error': 'errors',
            'statusmessage': 'messages'
        },
        MESSAGE_HASHES_NR = {
            1: 'messages',
            2: 'warnings',
            3: 'errors'
        },
        FOLLOWUP_DELAY = 200,
        Itag;

    if (!window.ITAGS[itagName]) {

        Itag = DOCUMENT.defineItag(itagName, {
            attrs: {
                events: 'string',
                readyContent: 'string'
            },

            init: function() {
                var element = this;
                element.setData('_currentMessageLevel', 0);
                element.setData('messages', []);
                element.setData('warnings', []);
                element.setData('errors', []);
                element.defineWhenUndefined('readyContent', DEFAULT_READY);
                element.defineWhenUndefined('content', element.model.readyContent || '');
                element.selfAfter('tap', element.finishMessage.bind(element), '>span:last-child button');
            },

            setupListener: function() {
                var element = this,
                    events = element.model.events.split(',');
                if (events.length>0) {
                    events.forEach(function(item, index) {
                        events[index] = item.trim();
                    });
                    element.setData('_listener', element.before(events, element.queueMessage.bind(element)));
                }
            },

            detachListener: function() {
                var element = this,
                    listener = this.getData('_listener');
                listener && listener.detach();
                element.removeData('_listener');
            },

            render: function() {
                this.setHTML('<span></span><span></span>');
            },

            sync: function() {
                var element = this,
                    model = element.model,
                    spans = element.getAll('>span'),
                    firstSpan = spans[0],
                    lastSpan = spans[1],
                    prevEvents = element.getData('_prevEvents'),
                    footer = model.footer,
                    events = model.events;
                if (events!==prevEvents) {
                    element.detachListener();
                    element.setupListener();
                    element.setData('_prevEvents', events);
                }
                firstSpan.setHTML(model.content);
                if (footer && (footer.contains('</button>') || footer.contains('</i-button>'))) {
                    lastSpan.setHTML(footer);
                }
                else {
                    // no button to close? then we might need to set one: in case the message doesn't disappear by itself:
                    if (!model.timeout) {
                        lastSpan.setHTML('<button class="pure-button">x</button>');
                    }
                }
                lastSpan.toggleClass('itsa-hidden', !footer);
            },

            finishMessage: function(e) {
                // fulfill with a containerNode --> the same as `dialog` does:
                var element = this,
                    buttonNode = e.target,
                    model = element.model,
                    messageSpan = element.getElement('>span'),
                    containerNode = messageSpan.cloneNode(true);
                containerNode.append(buttonNode.getOuterHTML());
                model.messagePromise.fulfill(containerNode);
                // we can safely remove the newly created container-node: the vdom holds it for 1 minute
                containerNode.remove();
            },

            queueMessage: function(e) {
                var element = this,
                    messagePromise = e.messagePromise,
                    type = e.type,
                    level = MESSAGE_LEVELS[type],
                    list = element.getData([MESSAGE_HASHES[type]]);
                // only process here: no further:
                e.halt();
                list[list.length] = messagePromise;
                messagePromise.finally(
                    function() {
                        list.remove(messagePromise);
                        // handle the next message (if there)
                        element.handleMessage(true);
                    }
                );
                (level>element.getData('_currentMessageLevel')) && element.handleMessage(!element.isWaiting(), level);
            },

            isWaiting: function() {
                return (this.getData('_currentMessageLevel')===0);
            },

            handleMessage: function(delay, level) {
                var element = this,
                    model = element.model,
                    messagePromise;
                if (!level) {
                    // search level
                    if (element.getData('errors').length>0) {
                        level = 3;
                    }
                    else if (element.getData('warnings').length>0) {
                        level = 2;
                    }
                    else if (element.getData('messages').length>0) {
                        level = 1;
                    }
                }
                if (!level || (element.getData([MESSAGE_HASHES_NR[level]]).length===0)) {
                    // DO NOT make messagePromise null: it sould be there as return value
                    // of the last message
                    element.setData('_currentMessageLevel', 0);
                    model.content = model.readyContent;
                    model.footer = null;
                    return;
                }
                element.setData('_currentMessageLevel', level);
                // now process the highest message
                messagePromise = element.getData([MESSAGE_HASHES_NR[level]])[0];
                if (delay) {
                    model.visible = false;
                    ITSA.later(element.showMessage.bind(element, messagePromise), FOLLOWUP_DELAY);
                }
                else {
                    ITSA.async(element.showMessage.bind(element, messagePromise));
                }
            },

            showMessage: function(messagePromise) {
                var model = this.model;
                model.messagePromise = messagePromise;
                model.content = messagePromise.content;
                model.footer = messagePromise.footer;
                model.visible = true;
            },

            destroy: function() {
                var element = this;
                element.detachListeners();
                element.removeData(); // all data
            }
        });

        window.ITAGS[itagName] = Itag;
    }

    return window.ITAGS[itagName];
};
