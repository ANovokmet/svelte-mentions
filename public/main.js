
function getHtml(label, query) {
    return label.replace(new RegExp(`^(${query})`, 'gi'), function($0) { 
        return `<b>${$0}</b>` 
    });
}

function getHtml2(label, query) {
    return label.replace(new RegExp(`(${query})`, 'gi'), function($0) { 
        return `<b>${$0}</b>` 
    });
}

new SMention({
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
                template: (item, query) => 
                    `<div class="image" style="background:wheat"></div>`+
                    `<div class="label">`+
                    `	<div class="title">${getHtml(item.name, query)}</div>`+
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
                template: (item, query) => 
                    `<div>`+
                    `	<span class="icon"></span>`+
                    `	<span class="id">${getHtml2(item.name, query)}:</span>`+
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