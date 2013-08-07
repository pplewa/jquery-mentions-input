/*global define,document*/

/*
 * Simple autocompeter (bundled with Mentions Input)
 * Version 1.0
 * Written by: Kenneth Auchenberg (Podio)
 * Dojo version by: Piotr Plewa (pplewa)
 *
 * License: MIT License - http://www.opensource.org/licenses/mit-license.php
 */
define([
	'dojo/_base/declare',
	'dojo/_base/lang',
	'dojo/_base/event',
	'dojo/Deferred',
	'dojo/on',
	'dojo/query',
	'dojo/dom-construct',
	'dojo/dom-class',
	'dojo/keys',
	'dojox/dtl/_base',
	'dojox/dtl/Context',
	'dojo/NodeList-dom',
	'dojo/NodeList-data',
	'dojo/NodeList-traverse',
	'dojox/NodeList/delegate'
], function (declare, lang, event, Deferred, on, query, domConstruct, domClass, keys, dtl, Context) {
	'use strict';

	var defaultOptions = {
		selectFirstItem: true,
		useAbsolutePosition: false,
		classes: {
			autoCompleteItemActive: 'active',
			item: 'item',
			autocompleter: ''
		}
	};

	var defaultTemplates = {
		wrapper: new dtl.Template('<div class="simple-autocompleter"></div>'),
		list: new dtl.Template('<ul class="hidden"></ul>'),
		item: new dtl.Template('<li class="item" data-id="{{ id }}"> <div class="image-block"> <div class="img space-right icon"> {{ itemIcon }} </div> <div class="bd"> <div class="info">{{ value }} </div> </div> </div> </li>'),
		// item: new dtl.Template('<li class="item" data-id="{{ id }}"> <div class="image-block"> {% if itemIcon %} <div class="img space-right icon"> {{ itemIcon }} </div> {% endif %}  <div class="bd"> <div class="info">{{ value }} </div> </div> </div> </li>'),
		image: new dtl.Template('<img src="{{ url }}" />'),
		icon: new dtl.Template('<div class="{{ icon }}"></div>')
	};

	var utils = {
		highlightTerm: function (value, term) {
			if (!term) {
				return value;
			}

			return value.replace(new RegExp('(?![^&;]+;)(?!<[^<>]*)(' + term + ')(?![^<>]*>)(?![^&;]+;)', 'gi'), '<b>$1</b>');
		}
	};

	var SimpleAutoCompleter = function(elmContainer, options) {
		this.options = lang.mixin({}, defaultOptions, options);
		this.templates = defaultTemplates;
		this.elmContainer = elmContainer;
		dtl._base.escape = function(val) { return val; };


		this.initialize.apply(this, arguments);
	};

	return lang.extend(SimpleAutoCompleter, {

		initialize: function() {
			this.initElements();
			this.delegateEvents();

			this.onItemSelected = new Deferred();
		},

		initElements: function() {
			if(!this.elmContainer) {
				throw 'No container element passed';
			}

			// Construct elements
			// this.elmWrapper = $( this.templates.wrapper() );
			this.elmWrapper = domConstruct.toDom(this.templates.wrapper.render());

			// this.elmAutocompleteList = $( this.templates.list() );
			this.elmAutocompleteList = domConstruct.toDom(this.templates.list.render());

			//this.elmAutocompleteList.appendTo( this.elmWrapper );
			domConstruct.place(this.elmAutocompleteList, this.elmWrapper);

			// Inject into DOM
			// this.elmWrapper.appendTo( this.elmContainer );
			domConstruct.place(this.elmWrapper, this.elmContainer);
		},

		delegateEvents: function() {
			// this.elmAutocompleteList.delegate('li', 'mousedown', this.onAutoCompleteItemMouseDown );
			// query(this.elmAutocompleteList).delegate('li', 'mousedown', lang.hitch(this, this.onAutoCompleteItemMouseDown));
			var autoComplete = lang.hitch(this, this.onAutoCompleteItemMouseDown);
			query(this.elmAutocompleteList).delegate('li', 'mousedown', function(evt) {
				return autoComplete(evt, this);
			});

			// Bind to container, since focus most likely is in a input element
			on(this.elmContainer, 'keydown', lang.hitch(this, this.onBoxKeyDown));
		},

		_selectItem: function(elmItem) {
			// elmItem.addClass( this.options.classes.autoCompleteItemActive );
			domClass.add(elmItem, this.options.classes.autoCompleteItemActive);

			// elmItem.siblings().removeClass( this.options.classes.autoCompleteItemActive );
			if (elmItem && elmItem.parentNode) {
				query(elmItem).siblings().removeClass(this.options.classes.autoCompleteItemActive);
			}
		},

		_getItemData: function(itemId) {
			var itemsCollection = this.currentItemsCollections;

			// var itemData = _.find(itemsCollection, function(item) {	return item.id === itemId; });
			return itemsCollection.filter(function(item) {
				return item.id === itemId;
			})[0];
		},

		onAutoCompleteItemMouseDown: function(e, target) {
			e.preventDefault();
			e.stopPropagation();

			// var itemId = query(e.currentTarget).data('id')[0];
			var itemId = query(target || e.target).data('id')[0];
			var itemData = this._getItemData(itemId);

			this.onItemSelected.progress(itemData);

			event.stop(e);
			return false;
		},

		onBoxKeyDown: function(e) {
			if ( !this.isVisible() ) {
				return true;
			}

			// var elmActiveItem = this.elmAutocompleteList.find('.' + this.options.classes.item + '.' + this.options.classes.autoCompleteItemActive);
			var elmActiveItem = query(this.elmAutocompleteList).query('.' + this.options.classes.item + '.' + this.options.classes.autoCompleteItemActive)[0];

			switch(e.keyCode) {
				case keys.DOWN_ARROW:
				case keys.UP_ARROW:

					if (e.keyCode === keys.DOWN_ARROW) {
						// elmActiveItem = elmActiveItem.length ? elmActiveItem.next('.' + this.options.classes.item): this.elmAutocompleteList.find('.' + this.options.classes.item).first();
						elmActiveItem = elmActiveItem ? query(elmActiveItem).next('.' + this.options.classes.item)[0] : query(this.elmAutocompleteList).query('.' + this.options.classes.item).first()[0];
					} else {
						// elmActiveItem = elmActiveItem.prev('.' + this.options.classes.item);
						elmActiveItem = query(elmActiveItem).prev('.' + this.options.classes.item)[0];
					}

					if (elmActiveItem) {
						this._selectItem(elmActiveItem);
					}

					event.stop(e);
					return false;

				case keys.ENTER:
				case keys.TAB:
					// elmActiveItem.trigger('mousedown');
					on.emit(elmActiveItem, 'mousedown', { bubbles: true, cancelable: true });
					event.stop(e);
					return false;

				case keys.ESCAPE:
					this.hide();
					event.stop(e);
					return false;
			}
		},

		renderList: function(items, termToHighlight) {
			return items.map(function(item, index) {
				// lang.hitch(this, termToHighlight)
				return this.renderItem(item, index, termToHighlight);
			}, this);
		},

		renderIcon: function(data) {
			var html;

			if (data.indexOf('/') > -1 ) { // Not a valid CSS class with / => image
				// html = this.templates.image({ url: data });
				html = this.templates.image.render(new Context({ url: data }));
			} else {
				html = this.templates.icon.render(new Context({ icon: data }));
			}

			return html;
		},

		renderItem: function(item, index, termToHighlight) {
			var htmlItemIcon;

			if (item.avatar) {
				htmlItemIcon = this.renderIcon( item.avatar );
			}

			var elmListItem = domConstruct.toDom(this.templates.item.render(new Context({
				id: item.id,
				value: utils.highlightTerm(item.name, termToHighlight),
				itemIcon: htmlItemIcon
			})));
			query(elmListItem).data('id', item.id);

			if (this.options.selectFirstItem && index === 0) {
				this._selectItem(elmListItem);
			}

			return elmListItem;
		},

		selectItem: function(index) {
			var elmItem = query(this.elmAutocompleteList).query('.' + this.options.classes.item)[index];

			this._selectItem(elmItem);
		},

		useActiveItem: function() {
			var elmActiveItem = query(this.elmAutocompleteList).query('.' + this.options.classes.item + '.' + this.options.classes.autoCompleteItemActive)[0];

			// elmActiveItem.trigger('mousedown');
			on.emit(elmActiveItem, "mousedown", { bubbles: true, cancelable: true });
		},

		populate: function(itemsCollection, termToHighlight) {
			if (!itemsCollection.length) {
				this.hide();
				return;
			}

			this.currentItemsCollections = itemsCollection;

			var elmTemp = domConstruct.create('div');
			var elmRenderedItems = this.renderList(itemsCollection, termToHighlight);

			// elmTemp.append.apply( elmTemp, elmRenderedItems);
			elmRenderedItems.forEach(function(item){
				domConstruct.place(item, elmTemp);
			});

			this.elmAutocompleteList.innerHTML = elmTemp.innerHTML;
			this.show();
		},

		show: function() {
			query(this.elmAutocompleteList).removeClass('hidden');
		},

		hide: function() {
			query(this.elmAutocompleteList).addClass('hidden');
			this.currentItemsCollections = null;
		},

		isVisible: function() {
			return !domClass.contains(this.elmAutocompleteList, 'hidden');
		},

		getActiveItemData: function() {
			var elmActiveItem = query(this.elmAutocompleteList).query('.' + this.options.classes.item + '.' + this.options.classes.autoCompleteItemActive)[0];

			if(!elmActiveItem) {
				return;
			}

			var itemId = query(elmActiveItem).data('id')[0];
			var itemData = this._getItemData(itemId);

			return itemData;
		}
	});
});