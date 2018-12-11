
function getMentionHtml(label, query) {
    return label.replace(new RegExp(`^(${query})`, 'gi'), function($0) { 
        return `<b>${$0}</b>` 
    });
}

function getTagHtml(label, query) {
    return label.replace(new RegExp(`(${query})`, 'gi'), function($0) { 
        return `<b>${$0}</b>` 
    });
}

const smention = new SMention({
	target: document.body,
	data: {
		configs: [
            {
                delimiter: '@',
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
                encode: (item) =>  `@<${item.name}>`,
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
                template: (item, query) => 
                    `<div class="image" style="background:wheat"></div>`+
                    `<div class="label">`+
                    `	<div class="title">${getMentionHtml(item.name, query)}</div>`+
                    `	<div class="subtitle">${item.email}</div>`+
                    `</div>`,
                filter: (options, query) => {
                    return options.filter(o => o.name.toLowerCase().startsWith(query.toLowerCase()));
                },
                itemClass: 'item'
            },
            {
                delimiter: '#',
                options: [
                    {
                        code: '1234',
                        name: 'Task 1234',
                        desc: 'Do task and finish it. Another sentence.'
                    },
                    {
                        code: '1256',
                        name: 'Bug 1256',
                        desc: 'Fix very important and critical bug'
                    }
                ],
                encode: (item) =>  `#${item.code}`,
                decode: (text, options) => {
                    const re = new RegExp('#([0-9]+)', "g");
                    let m;
                    const mentions = [];
                    while (m = re.exec(text)) {
                        const code = m[1];
                        const item = options.find(item => item.code === code);
                        if(item){
                            mentions.push(item);
                        }
                    }
                    console.log('mentioned: ', mentions);
                },
                template: (item, query) => 
                    `<div>`+
                    `	<span class="icon"></span>`+
                    `	<span class="id">${getTagHtml(item.name, query)}:</span>`+
                    `	<span class="title">${item.desc}</span>`+
                    `</div>`,
                filter: (options, query) => {
                    return options.filter(o => o.name.toLowerCase().includes(query.toLowerCase()));
                },
                itemClass: 'task item'
            }
        ]
	}
});

const dataInput = document.getElementById('data');
smention.refs.input.addEventListener('keyup', () => {
    dataInput.innerText = smention.get().inputValue;
});