var SMention = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function null_to_empty(value) {
        return value == null ? '' : value;
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function toggle_class(element, name, toggle) {
        element.classList[toggle ? 'add' : 'remove'](name);
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }
    class HtmlTag {
        constructor(anchor = null) {
            this.a = anchor;
            this.e = this.n = null;
        }
        m(html, target, anchor = null) {
            if (!this.e) {
                this.e = element(target.nodeName);
                this.t = target;
                this.h(html);
            }
            this.i(anchor);
        }
        h(html) {
            this.e.innerHTML = html;
            this.n = Array.from(this.e.childNodes);
        }
        i(anchor) {
            for (let i = 0; i < this.n.length; i += 1) {
                insert(this.t, this.n[i], anchor);
            }
        }
        p(html) {
            this.d();
            this.h(html);
            this.i(this.a);
        }
        d() {
            this.n.forEach(detach);
        }
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const prop_values = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, prop_values, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if ($$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set() {
            // overridden by instance, if it has props
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.23.2' }, detail)));
    }
    function append_dev(target, node) {
        dispatch_dev("SvelteDOMInsert", { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev("SvelteDOMInsert", { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev("SvelteDOMRemove", { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ["capture"] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev("SvelteDOMAddEventListener", { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev("SvelteDOMRemoveEventListener", { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev("SvelteDOMRemoveAttribute", { node, attribute });
        else
            dispatch_dev("SvelteDOMSetAttribute", { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.data === data)
            return;
        dispatch_dev("SvelteDOMSetData", { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error(`'target' is a required option`);
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn(`Component was already destroyed`); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    /* src\SMention.svelte generated by Svelte v3.23.2 */

    const file = "src\\SMention.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[19] = list[i];
    	return child_ctx;
    }

    // (115:16) {:else}
    function create_else_block(ctx) {
    	let t_value = highlight(/*match*/ ctx[19].label, /*query*/ ctx[2]) + "";
    	let t;

    	const block = {
    		c: function create() {
    			t = text(t_value);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*matches, query*/ 36 && t_value !== (t_value = highlight(/*match*/ ctx[19].label, /*query*/ ctx[2]) + "")) set_data_dev(t, t_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block.name,
    		type: "else",
    		source: "(115:16) {:else}",
    		ctx
    	});

    	return block;
    }

    // (113:16) {#if activeConfig.template}
    function create_if_block(ctx) {
    	let html_tag;
    	let raw_value = /*activeConfig*/ ctx[6].template(/*match*/ ctx[19], /*query*/ ctx[2]) + "";

    	const block = {
    		c: function create() {
    			html_tag = new HtmlTag(null);
    		},
    		m: function mount(target, anchor) {
    			html_tag.m(raw_value, target, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*activeConfig, matches, query*/ 100 && raw_value !== (raw_value = /*activeConfig*/ ctx[6].template(/*match*/ ctx[19], /*query*/ ctx[2]) + "")) html_tag.p(raw_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) html_tag.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(113:16) {#if activeConfig.template}",
    		ctx
    	});

    	return block;
    }

    // (109:8) {#each matches as match}
    function create_each_block(ctx) {
    	let li;
    	let t;
    	let li_class_value;
    	let mounted;
    	let dispose;

    	function select_block_type(ctx, dirty) {
    		if (/*activeConfig*/ ctx[6].template) return create_if_block;
    		return create_else_block;
    	}

    	let current_block_type = select_block_type(ctx, -1);
    	let if_block = current_block_type(ctx);

    	function click_handler(...args) {
    		return /*click_handler*/ ctx[15](/*match*/ ctx[19], ...args);
    	}

    	const block = {
    		c: function create() {
    			li = element("li");
    			if_block.c();
    			t = space();
    			attr_dev(li, "class", li_class_value = "" + (null_to_empty(/*activeConfig*/ ctx[6].itemClass) + " svelte-1x0ru93"));
    			toggle_class(li, "selected", /*selected*/ ctx[4] === /*match*/ ctx[19]);
    			add_location(li, file, 109, 12, 3439);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, li, anchor);
    			if_block.m(li, null);
    			append_dev(li, t);

    			if (!mounted) {
    				dispose = listen_dev(li, "click", click_handler, false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (current_block_type === (current_block_type = select_block_type(ctx, dirty)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(li, t);
    				}
    			}

    			if (dirty & /*activeConfig*/ 64 && li_class_value !== (li_class_value = "" + (null_to_empty(/*activeConfig*/ ctx[6].itemClass) + " svelte-1x0ru93"))) {
    				attr_dev(li, "class", li_class_value);
    			}

    			if (dirty & /*activeConfig, selected, matches*/ 112) {
    				toggle_class(li, "selected", /*selected*/ ctx[4] === /*match*/ ctx[19]);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(li);
    			if_block.d();
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(109:8) {#each matches as match}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let textarea;
    	let t0;
    	let div1;
    	let ul;
    	let t1;
    	let div0;
    	let t2;
    	let t3_value = /*matches*/ ctx[5].length + "";
    	let t3;
    	let t4;
    	let mounted;
    	let dispose;
    	let each_value = /*matches*/ ctx[5];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			textarea = element("textarea");
    			t0 = space();
    			div1 = element("div");
    			ul = element("ul");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t1 = space();
    			div0 = element("div");
    			t2 = text("Showing ");
    			t3 = text(t3_value);
    			t4 = text(" results.");
    			attr_dev(textarea, "class", "smentions-textarea svelte-1x0ru93");
    			add_location(textarea, file, 100, 0, 3132);
    			attr_dev(ul, "class", "items svelte-1x0ru93");
    			add_location(ul, file, 107, 4, 3373);
    			attr_dev(div0, "class", "results svelte-1x0ru93");
    			add_location(div0, file, 120, 4, 3843);
    			attr_dev(div1, "class", "dropdown svelte-1x0ru93");
    			toggle_class(div1, "hidden", !/*dropdownOpened*/ ctx[3]);
    			add_location(div1, file, 106, 0, 3314);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, textarea, anchor);
    			set_input_value(textarea, /*value*/ ctx[0]);
    			/*textarea_binding*/ ctx[14](textarea);
    			insert_dev(target, t0, anchor);
    			insert_dev(target, div1, anchor);
    			append_dev(div1, ul);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(ul, null);
    			}

    			append_dev(div1, t1);
    			append_dev(div1, div0);
    			append_dev(div0, t2);
    			append_dev(div0, t3);
    			append_dev(div0, t4);

    			if (!mounted) {
    				dispose = [
    					listen_dev(textarea, "input", /*textarea_input_handler*/ ctx[13]),
    					listen_dev(textarea, "keydown", /*updateSelection*/ ctx[7], false, false, false),
    					listen_dev(textarea, "keyup", /*updateValue*/ ctx[8], false, false, false),
    					listen_dev(textarea, "click", /*updateValue*/ ctx[8], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*value*/ 1) {
    				set_input_value(textarea, /*value*/ ctx[0]);
    			}

    			if (dirty & /*activeConfig, selected, matches, selectMatch, query, highlight*/ 628) {
    				each_value = /*matches*/ ctx[5];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(ul, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}

    			if (dirty & /*matches*/ 32 && t3_value !== (t3_value = /*matches*/ ctx[5].length + "")) set_data_dev(t3, t3_value);

    			if (dirty & /*dropdownOpened*/ 8) {
    				toggle_class(div1, "hidden", !/*dropdownOpened*/ ctx[3]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(textarea);
    			/*textarea_binding*/ ctx[14](null);
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(div1);
    			destroy_each(each_blocks, detaching);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function highlight(input, query) {
    	return input.replace(new RegExp(`(${query})`, "gi"), $0 => `<b>${$0}</b>`);
    }

    function instance($$self, $$props, $$invalidate) {
    	const KEY_CODE = { up: 38, down: 40, enter: 13 };
    	let element$$1;
    	let { configs } = $$props;
    	let { value = "" } = $$props;
    	let { onChange = null } = $$props;
    	let { onSelected = null } = $$props;
    	let query = "";
    	let dropdownOpened = false;
    	let selected = null;
    	let matches = [];
    	let activeConfig = null;

    	function updateSelection(event) {
    		if (dropdownOpened && event.which === KEY_CODE.up) {
    			moveSelectionUp();
    			event.preventDefault();
    		}

    		if (dropdownOpened && event.which === KEY_CODE.down) {
    			moveSelectionDown();
    			event.preventDefault();
    		}

    		if (dropdownOpened && event.which === KEY_CODE.enter) {
    			selectMatch(selected);
    			event.preventDefault();
    		}
    	}

    	function updateValue(event) {
    		if (dropdownOpened && (event.which === KEY_CODE.up || event.which === KEY_CODE.down || event.which === KEY_CODE.enter)) {
    			return false;
    		}

    		const inputToCursor = value.slice(0, element$$1.selectionStart);
    		($$invalidate(5, matches = []), $$invalidate(6, activeConfig = null));

    		configs.forEach(config => {
    			const delimiterMatches = inputToCursor.match(new RegExp(config.delimiter + "[\\w\\s]+$", "g"));

    			if (delimiterMatches) {
    				$$invalidate(2, query = delimiterMatches[delimiterMatches.length - 1].substring(1));
    				$$invalidate(5, matches = config.filter(config.options, query));
    				$$invalidate(6, activeConfig = config);
    			}
    		});

    		if (matches.length > 0) {
    			($$invalidate(3, dropdownOpened = true), $$invalidate(4, selected = matches[0]));
    		} else {
    			($$invalidate(3, dropdownOpened = false), $$invalidate(4, selected = null));
    		}
    	}

    	function moveSelectionDown() {
    		const index = matches.indexOf(selected);

    		if (index < matches.length - 1) {
    			$$invalidate(4, selected = matches[index + 1]);
    		}
    	}

    	function moveSelectionUp() {
    		const index = matches.indexOf(selected);

    		if (index >= 1) {
    			$$invalidate(4, selected = matches[index - 1]);
    		}
    	}

    	function selectMatch(selected) {
    		const inputToCursor = value.slice(0, element$$1.selectionStart);
    		const delimiterMatches = inputToCursor.match(new RegExp(activeConfig.delimiter + "[\\w\\s]+$", "g"));

    		if (delimiterMatches) {
    			const result = delimiterMatches[delimiterMatches.length - 1];
    			const inputAfterCursor = value.slice(element$$1.selectionStart, value.length);

    			$$invalidate(0, value = inputToCursor.replace(new RegExp(result + "$"), activeConfig.encode(selected)) + (inputAfterCursor && inputAfterCursor[0] == " "
    			? ""
    			: " ") + inputAfterCursor);

    			if (onSelected) onSelected({ match: selected, config: activeConfig });
    			$$invalidate(3, dropdownOpened = false);
    		}
    	}

    	const writable_props = ["configs", "value", "onChange", "onSelected"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<SMention> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("SMention", $$slots, []);

    	function textarea_input_handler() {
    		value = this.value;
    		$$invalidate(0, value);
    	}

    	function textarea_binding($$value) {
    		binding_callbacks[$$value ? "unshift" : "push"](() => {
    			element$$1 = $$value;
    			$$invalidate(1, element$$1);
    		});
    	}

    	const click_handler = match => selectMatch(match);

    	$$self.$set = $$props => {
    		if ("configs" in $$props) $$invalidate(10, configs = $$props.configs);
    		if ("value" in $$props) $$invalidate(0, value = $$props.value);
    		if ("onChange" in $$props) $$invalidate(11, onChange = $$props.onChange);
    		if ("onSelected" in $$props) $$invalidate(12, onSelected = $$props.onSelected);
    	};

    	$$self.$capture_state = () => ({
    		KEY_CODE,
    		element: element$$1,
    		configs,
    		value,
    		onChange,
    		onSelected,
    		query,
    		dropdownOpened,
    		selected,
    		matches,
    		activeConfig,
    		updateSelection,
    		updateValue,
    		moveSelectionDown,
    		moveSelectionUp,
    		selectMatch,
    		highlight
    	});

    	$$self.$inject_state = $$props => {
    		if ("element" in $$props) $$invalidate(1, element$$1 = $$props.element);
    		if ("configs" in $$props) $$invalidate(10, configs = $$props.configs);
    		if ("value" in $$props) $$invalidate(0, value = $$props.value);
    		if ("onChange" in $$props) $$invalidate(11, onChange = $$props.onChange);
    		if ("onSelected" in $$props) $$invalidate(12, onSelected = $$props.onSelected);
    		if ("query" in $$props) $$invalidate(2, query = $$props.query);
    		if ("dropdownOpened" in $$props) $$invalidate(3, dropdownOpened = $$props.dropdownOpened);
    		if ("selected" in $$props) $$invalidate(4, selected = $$props.selected);
    		if ("matches" in $$props) $$invalidate(5, matches = $$props.matches);
    		if ("activeConfig" in $$props) $$invalidate(6, activeConfig = $$props.activeConfig);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*onChange, value*/ 2049) {
    			$: if (onChange) onChange(value);
    		}
    	};

    	return [
    		value,
    		element$$1,
    		query,
    		dropdownOpened,
    		selected,
    		matches,
    		activeConfig,
    		updateSelection,
    		updateValue,
    		selectMatch,
    		configs,
    		onChange,
    		onSelected,
    		textarea_input_handler,
    		textarea_binding,
    		click_handler
    	];
    }

    class SMention extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance, create_fragment, safe_not_equal, {
    			configs: 10,
    			value: 0,
    			onChange: 11,
    			onSelected: 12
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "SMention",
    			options,
    			id: create_fragment.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*configs*/ ctx[10] === undefined && !("configs" in props)) {
    			console.warn("<SMention> was created without expected prop 'configs'");
    		}
    	}

    	get configs() {
    		throw new Error("<SMention>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set configs(value) {
    		throw new Error("<SMention>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get value() {
    		throw new Error("<SMention>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set value(value) {
    		throw new Error("<SMention>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get onChange() {
    		throw new Error("<SMention>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set onChange(value) {
    		throw new Error("<SMention>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get onSelected() {
    		throw new Error("<SMention>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set onSelected(value) {
    		throw new Error("<SMention>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    return SMention;

}());
//# sourceMappingURL=SMention.js.map
