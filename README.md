*Work in progress*

Simple suggesting input that supports both mentions and tags. Made with Svelte.

## Configuration

See *./public/main.js* for an example how svelte-mentions is initialized and configured...

```
// configs, it is a list so multiple configurations (eg. mentions and tags) are supported
configs: [
    {
        // delimiter that triggers dropdown with suggestion
        delimiter: '@',
        // list of options
        options: [
            {
                name: 'Ante Novokmet',
                email: 'ante.novokmet@gdi.net'
            },
            {
                name: 'Ante Vujevic',
                email: 'ante.vujevic@mps.hr'
            },
            {
                name: 'Anto Djapic',
                email: 'anto@gmail.com'
            }
        ],
        // when option is selected from dropdown this value is inserted
        encode: (item) =>  `@<${item.name}>`,
        // gets references to mentions from text
        decode: (text, options) => {
            const re = new RegExp('@<([\\w\\s]+)>', "g");
            let m;
            const mentions = [];
            while (m = re.exec(text)) {
                const name = m[1];
                const item = options.find(item => item.name === name);
                if(item){
                    mentions.push(item);
                }
            }
            console.log('mentioned: ', mentions);
        },
        // creates dropdown template
        template: (item, query) => 
            `<div class="image" style="background:wheat"></div>`+
            `<div class="label">`+
            `	<div class="title">${getMentionHtml(item.name, query)}</div>`+
            `	<div class="subtitle">${item.email}</div>`+
            `</div>`,
        // populates drop down after delimiter is entered
        filter: (options, query) => {
            return options.filter(o => o.name.toLowerCase().startsWith(query.toLowerCase()));
        },
        // class applied to dropdown li element
        itemClass: 'item'
    }
]
```


## Build from sources

Install the dependencies...

```bash
cd svelte-mentions
npm install
```

...then start [Rollup](https://rollupjs.org):

```bash
npm run dev
```

Navigate to [localhost:5000](http://localhost:5000). Edit a component file in `src`, save it, and reload the page to see your changes.

## TBD

- Usage with existing text inputs
- Support for contenteditable="true" inputs


