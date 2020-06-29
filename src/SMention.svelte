<script>
    const KEY_CODE = {
        up: 38,
        down: 40,
        enter: 13
    }

    let element;
    
    export let configs;
    export let value = '';

    export let onChange = null;
    export let onSelected = null;

    let query = '';
    let dropdownOpened = false;
    let selected = null;
    let matches = [];
    let activeConfig = null;
    
    function updateSelection(event){
        if(dropdownOpened && event.which === KEY_CODE.up) {
            moveSelectionUp();
            event.preventDefault();
        }

        if(dropdownOpened && event.which === KEY_CODE.down) { 
            moveSelectionDown();
            event.preventDefault();
        }

        if(dropdownOpened && event.which === KEY_CODE.enter) {
            selectMatch(selected);
            event.preventDefault();
        }
    }

    function updateValue(event) {
        if(dropdownOpened && (event.which === KEY_CODE.up || event.which === KEY_CODE.down || event.which === KEY_CODE.enter)) {
            return false;
        }

        const inputToCursor = value.slice(0, element.selectionStart);
        matches = [], activeConfig = null;

        configs.forEach(config => {
            const delimiterMatches = inputToCursor.match(new RegExp(config.delimiter + '[\\w\\s]+$', "g"));
            if(delimiterMatches) {
                query = delimiterMatches[delimiterMatches.length - 1].substring(1);
                matches = config.filter(config.options, query);
                activeConfig = config;
            }
        });

        if(matches.length > 0) {
            dropdownOpened = true, selected = matches[0];
        }
        else {
            dropdownOpened = false, selected = null;
        }
    }

    function moveSelectionDown() {
        const index = matches.indexOf(selected);
        if(index < matches.length - 1) {
            selected = matches[index + 1];
        }
    }

    function moveSelectionUp() {
        const index = matches.indexOf(selected);
        if(index >= 1) {
            selected = matches[index - 1];
        }
    }

    function selectMatch(selected) {
        const inputToCursor = value.slice(0, element.selectionStart);
        const delimiterMatches = inputToCursor.match(new RegExp(activeConfig.delimiter + '[\\w\\s]+$', "g"));
        if(delimiterMatches) {
            const result = delimiterMatches[delimiterMatches.length - 1];
            const inputAfterCursor = value.slice(element.selectionStart, value.length);

            value = inputToCursor.replace(new RegExp(result + '$'), activeConfig.encode(selected)) 
                + (inputAfterCursor && inputAfterCursor[0] == ' ' ? '' : ' ')
                + inputAfterCursor;
            
            if(onSelected) onSelected({ match: selected, config: activeConfig });
            dropdownOpened = false;
        }
    }

    function highlight(input, query) {
        return input.replace(new RegExp(`(${query})`, 'gi'), ($0) => `<b>${$0}</b>`);
    }

    $: if(onChange) onChange(value);
</script>

<textarea class="smentions-textarea" 
    bind:value
    bind:this={element}
    on:keydown={updateSelection}
    on:keyup={updateValue}
    on:click={updateValue}></textarea>
<div class="dropdown" class:hidden={!dropdownOpened}>
    <ul class="items">
        {#each matches as match}
            <li class={activeConfig.itemClass} 
                class:selected={selected===match}
                on:click={() => selectMatch(match)}>
                {#if activeConfig.template}
                    {@html activeConfig.template(match, query)}
                {:else}
                    {highlight(match.label, query)}
                {/if}
            </li>
        {/each}
    </ul>
    <div class="results">
        Showing {matches.length} results.
    </div>
</div>

<style>
    .smentions-textarea {
        width: 800px;
        resize: none;
    }

    .dropdown {
        width: 800px;    
        box-sizing: border-box;
        border: 1px solid #ccc;
    }

    .dropdown.hidden {
        display: none;
    }
    
    .items {
        list-style: none;
        margin: 0;
        padding: 0;
    }
    
    .results {
        padding: 4px;
        height: 24px;
        color: rgba(0,0,0,.55);
        font-size: 14px;
        box-sizing: border-box;
    }
</style>