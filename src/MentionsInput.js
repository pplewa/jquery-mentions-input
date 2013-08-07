/*global define,document,setTimeout,navigator*/

/*
 * MentionsInput
 * Version 2.0
 * Written by: Kenneth Auchenberg
 * Dojo version by: Piotr Plewa (pplewa)
 *
 * Copyright (c) 2013 - Citrix Systems, Inc.
 * License: MIT License - http://www.opensource.org/licenses/mit-license.php
 */
define([
	'dojo/_base/declare',
	'dojo/_base/lang',
	'dojo/_base/event',
	'dojo/sniff',
	'dojo/on',
	'dojo/query',
	'dojo/dom-construct',
	'dojo/keys',
	'dojox/dtl/_base',
	'dojox/dtl/Context',
	'dojox/html/entities',
	'./SimpleAutoCompleter',
	'dojo/NodeList-dom',
	'dojo/NodeList-data',
	'dojo/NodeList-traverse',
	'dojo/NodeList-manipulate',
	'dojox/NodeList/delegate'
], function (declare, lang, event, sniff, on, query, domConstruct, keys, dtl, Context, entities, SimpleAutoCompleter) {
	'use strict';

	var defaultSettings = {
		triggerChar: '@',
		onDataRequest: function() {},
		minChars: 0,
		showAvatars: true,
		insertSpaceAfterMention: false,
		resetOnInitialize: false,
		templates: {
			wrapper: new dtl.Template('<div class="mentions-input-box"></div>'),
			mentionsOverlay: new dtl.Template('<div class="mentions"><div></div></div>'),
			mentionItemSyntax: new dtl.Template('@[{{ value }}]({{ type }}:{{ id }})'),
			mentionItemHighlight: new dtl.Template('<strong><span>{{ value }}</span></strong>')
		},
		autoCompleter: {
			initialize: function(elmWrapperBox, mentionsInput) {
				var self = this;
				var autoCompleter = new SimpleAutoCompleter(elmWrapperBox, {});

				autoCompleter.onItemSelected.then(function(value){}, function(err){}, function(item) {
					mentionsInput.addMention(self.format(item));
				});

				return autoCompleter;
			},
			getSelectedItem: 'getActiveItemData',
			isVisible: 'isVisible',
			populate: 'populate',
			loading: function() {},
			hide: 'hide',
			format: function(item) {
				return {
					value: item.name,
					id: item.id,
					type: item.type
				};
			}
		}
	};

	var utils = {
		setCaratPosition: function (domNode, caretPos) {
			if (domNode.createTextRange) {
				var range = domNode.createTextRange();
				range.move('character', caretPos);
				range.select();
			} else {
				if (domNode.selectionStart) {
					domNode.focus();
					domNode.setSelectionRange(caretPos, caretPos);
				} else {
					domNode.focus();
				}
			}
		},

		rtrim: function(string) {
			return string.replace(/\s+$/,'');
		}
	};

	var MentionsInput = function(elmTarget, settings) {

		// _.bindAll(this, 'onInputBoxKeyDown', 'onInputBoxKeyPress', 'onInputBoxInput', 'onInputBoxClick', 'onInputBoxBlur', 'resetBuffer', 'getMentions', 'val');

		this.elmInputWrapper = null;
		this.elmWrapperBox = null;
		this.elmMentionsOverlay = null;

		this.autoCompleter = null;
		this.mentionsCollection = [];
		this.inputBuffer = [];
		this.currentDataQuery = '';

		this.initialize.call(this, elmTarget, settings);
	};

	return lang.extend(MentionsInput, {

		initialize: function(elmTarget, settings) {

			// this.elmInputBox = $(elmTarget);
			this.elmInputBox = elmTarget;
			this.settings = lang.mixin({}, defaultSettings, settings);

			this.initTextarea();
			this.initMentionsOverlay();
			this.initAutocomplete();

			if(this.settings.resetOnInitialize) {
				this.resetInput();
			}

			if(this.settings.prefillMention) {
				this.addMention( this.settings.prefillMention );
			}
		},

		initAutocomplete: function() {
			this.autoCompleter = this.settings.autoCompleter.initialize(this.elmWrapperBox, this);
		},

		initTextarea: function() {

			this.elmInputWrapper = this.elmInputBox.parentNode;
			this.elmWrapperBox = domConstruct.toDom(this.settings.templates.wrapper.render());
			query(this.elmInputBox).wrapAll(this.elmWrapperBox);
			this.elmWrapperBox = query(this.elmInputWrapper).query('> div')[0];

			// this.elmInputBox.bind('keydown.mentionsInput', this.onInputBoxKeyDown);
			// this.elmInputBox.bind('keypress.mentionsInput', this.onInputBoxKeyPress);
			// this.elmInputBox.bind('input.mentionsInput', this.onInputBoxInput);
			// this.elmInputBox.bind('click.mentionsInput', this.onInputBoxClick);
			// this.elmInputBox.bind('blur.mentionsInput', this.onInputBoxBlur);
			on(this.elmInputBox, 'keydown', lang.hitch(this, this.onInputBoxKeyDown));
			on(this.elmInputBox, 'keypress', lang.hitch(this, this.onInputBoxKeyPress));
			on(this.elmInputBox, 'click', lang.hitch(this, this.onInputBoxClick));
			on(this.elmInputBox, 'blur', lang.hitch(this, this.onInputBoxBlur));
			on(this.elmInputBox, 'input', lang.hitch(this, this.onInputBoxInput));

			// if ie8 then poll for changes
			// if (sniff('ie') == 8) {
			//	this.elmInputBox.attachEvent("onpropertychange", lang.hitch(this, function(e) {
			//		if (e.propertyName === "value") {
			//			this.onInputBoxInput();
			//		}
			//	}));
			//	on(this.elmInputBox, 'paste,cut,drop', lang.hitch(this, this.onInputBoxInput));


			//	on(this.elmInputBox, 'focus', lang.hitch(this, function() {
			//		this.onInputBoxInput();
			//		setTimeout(lang.hitch(this, this.onInputBoxInput), 250);
			//	}));
			// }

		},

		initMentionsOverlay: function() {

			// Contruct element
			this.elmMentionsOverlay = domConstruct.toDom(this.settings.templates.mentionsOverlay.render());

			// Copy CSS properties to inner <div>
			var cssHash = {};
			var cssProperties = ['lineHeight', 'fontSize', 'fontFamily', 'fontWeight'];
			var i = cssProperties.length;
			while (i--) {
				cssHash[cssProperties[i]] = this.elmInputBox.style[cssProperties[i]];
			}
			// this.elmMentionsOverlay.find('div').css( cssHash );
			query(this.elmMentionsOverlay).query('div').style(cssHash);

			// Append to wrapper
			query(this.elmMentionsOverlay).prependTo(this.elmWrapperBox);
		},

		_autoCompleterMethod: function(method) {

			var ref = this.settings.autoCompleter[method];

			if(typeof ref === "function") {
				return ref();
			} else {
				return this.autoCompleter[ref]();
			}

		},

		_doSearch: function(query) {
			var self = this;

			if (this.settings.minChars === 0 || (query && query.length && query.length >= this.settings.minChars)) {

				this._autoCompleterMethod('loading');

				this.settings.onDataRequest.call(this, 'search', query, function (autoCompleteData) {

					// Filter items that has already been mentioned
					// var mentionValues = _.pluck(self.mentionsCollection, 'value');
					var mentionValues = self.mentionsCollection.map(function(mention) {
						return mention.value;
					});

					// autoCompleteData = _.reject(autoCompleteData, function (item) {
					//	return _.include(mentionValues, item.name);
					// });

					autoCompleteData = autoCompleteData.filter(function(value, index, list) {
						return !(function (item) {
							return mentionValues.indexOf(item.name) !== -1;
						}).call(null, value, index, list);
					});

					self.autoCompleter.populate(autoCompleteData, query);

				});
			} else {
				this.hideAutoCompleter();
			}
		},

		hideAutoCompleter: function() {
			this._autoCompleterMethod('hide');
		},

		replaceAll: function(text, match, replacement) {
			// Utility method to replace all occurences
			match = match.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&');
			return text.replace(new RegExp(match, 'gm'), replacement);
		},

		updateValues: function() {
			var syntaxMessage = this.getInputBoxValue();

			this.mentionsCollection.forEach(function (mention) {
				var textSyntax = this.settings.templates.mentionItemSyntax.render(new Context(mention));
				syntaxMessage = this.replaceAll(syntaxMessage, mention.value, textSyntax);
			}, this);

			var mentionText = entities.encode(syntaxMessage);

			this.mentionsCollection.forEach(function(mention) {

				var formattedMention = lang.mixin({}, mention, {
					value: entities.encode(mention.value)
				});

				var textSyntax = this.settings.templates.mentionItemSyntax.render(new Context(formattedMention));
				var textHighlight = this.settings.templates.mentionItemHighlight.render(new Context(formattedMention));

				mentionText = this.replaceAll(mentionText, textSyntax, textHighlight);

			}, this);

			mentionText = mentionText.replace(/\n/g, '<br />');
			mentionText = mentionText.replace(/ {2}/g, '&nbsp; ');

			this.messageText = syntaxMessage;
			query(this.elmMentionsOverlay).query('div')[0].innerHTML = mentionText;
		},

		resetBuffer: function() {
			this.inputBuffer = [];
		},

		resetInput: function() {
			this.elmInputBox.value = '';
			this.mentionsCollection = [];
			this.updateValues();
		},

		updateMentionsCollection: function() {
			var inputText = this.getInputBoxValue();

			// this.mentionsCollection = _.reject(this.mentionsCollection, function (mention) {
			//	return !mention.value || inputText.indexOf(mention.value) === -1;
			// });

			this.mentionsCollection = this.mentionsCollection.filter(function(value, index, list) {
				return !(function (mention) {
					return !mention.value || inputText.indexOf(mention.value) === -1;
				}).call(null, value, index, list);
			});

			this.mentionsCollection = this.mentionsCollection.filter(function(value) {
				return value;
			});
		},

		addMention: function(mention) {

			var currentMessage = this.getInputBoxValue();

			// Using a regex to figure out positions
			var regex = new RegExp('\\' + this.settings.triggerChar + this.currentDataQuery, 'gi');
			regex.exec(currentMessage);

			var startCaretPosition = regex.lastIndex - this.currentDataQuery.length - 1;
			var currentCaretPosition = regex.lastIndex;

			var start = currentMessage.substr(0, startCaretPosition);
			var end = currentMessage.substr(currentCaretPosition, currentMessage.length);
			var startEndIndex = (start + mention.value).length;

			if(this.settings.insertSpaceAfterMention) {
				startEndIndex = startEndIndex + 1;
			}

			//Check if the user is being mentioned twice (or more)
			// var contained = _.find(this.mentionsCollection, function(existingMention) {
			//	return _.isEqual(existingMention, mention);
			// });
			var contained = this.mentionsCollection.filter(function(existingMention) {
				return JSON.stringify(existingMention) === JSON.stringify(mention);
			})[0];

			if(!contained) {
				this.mentionsCollection.push(mention);
			}

			// Cleaning before inserting the value, otherwise auto-complete would be triggered with "old" inputbuffer
			this.currentDataQuery = '';
			this.resetBuffer();
			this.hideAutoCompleter();

			// Mentions & syntax message
			var updatedMessageText = start + mention.value;
			if( this.settings.insertSpaceAfterMention ) {
				updatedMessageText = updatedMessageText + ' ';
			}
			updatedMessageText = updatedMessageText + end;

			this.elmInputBox.value = updatedMessageText;
			this.updateValues();

			// Set correct focus and selection
			this.elmInputBox.focus();

			utils.setCaratPosition(this.elmInputBox, startEndIndex);
		},

		getInputBoxValue: function() {
			return this.elmInputBox.value;
		},

		// Event handlers
		onInputBoxClick: function() {
			this.resetBuffer();
		},

		onInputBoxBlur: function() {
			this.hideAutoCompleter();
		},

		onInputBoxInput: function() {

			this.updateValues();
			this.updateMentionsCollection();

			// var triggerCharIndex = _.lastIndexOf(this.inputBuffer, this.settings.triggerChar);
			var triggerCharIndex = this.inputBuffer.lastIndexOf(this.settings.triggerChar);

			if (triggerCharIndex === 0) {
				this.currentDataQuery = this.inputBuffer.slice(triggerCharIndex + 1).join('');
				this.currentDataQuery = utils.rtrim(this.currentDataQuery);

				// _.defer(_.bind(this._doSearch, this, this.currentDataQuery));
				setTimeout(lang.hitch(this, function(){
					return this._doSearch.call(this, this.currentDataQuery);
				}), 0);
			} else {
				this.hideAutoCompleter();
			}
		},

		onInputBoxKeyPress: function(e) {
			if(e.keyCode !== keys.BACKSPACE) {
				var typedValue = String.fromCharCode(e.which || e.keyCode);
				this.inputBuffer.push(typedValue);
			}
		},

		onInputBoxKeyDown: function(e) {

			// This also matches HOME/END on OSX which is CMD+LEFT, CMD+RIGHT
			if (e.keyCode === keys.LEFT_ARROW || e.keyCode === keys.RIGHT_ARROW || e.keyCode === keys.HOME || e.keyCode === keys.END ) {
				// Defer execution to ensure carat pos has changed after HOME/END keys
				setTimeout(lang.hitch(this, this.resetBuffer), 0);

				// IE9 doesn't fire the oninput event when backspace or delete is pressed. This causes the highlighting
				// to stay on the screen whenever backspace is pressed after a highlighed word. This is simply a hack
				// to force updateValues() to fire when backspace/delete is pressed in IE9.
				if (navigator.userAgent.indexOf('MSIE 9') > -1) {
					setTimeout(lang.hitch(this, this.updateValues), 0);
				}

				// event.stop(e);
				return;
			}

			// Special handling for space, since we want to reset buffer on space, but only when autocompleter is hidden
			if (e.keyCode === keys.SPACE) {

				if (this._autoCompleterMethod('isVisible')) {
					// Allow spaces when autcompleter is visible
					// event.stop(e);
					return;
				}

				setTimeout(lang.hitch(this, this.resetBuffer), 0);
			}

			if (e.keyCode === keys.ENTER) {
				setTimeout(lang.hitch(this, this.resetBuffer), 0);
			}

			if (e.keyCode === keys.BACKSPACE) {
				this.inputBuffer = this.inputBuffer.slice(0, -1 + this.inputBuffer.length); // Can't use splice, not available in IE
				// event.stop(e);
				return;
			}

			return true;
		},

		// External methods
		val: function () {
			var value = this.mentionsCollection.length ? this.messageText : this.getInputBoxValue();
			return value;
		},

		getMentions: function () {
			return this.mentionsCollection;
		}

	});

});