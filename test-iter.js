import nunjucks from './src/index.js';

const templates = [
  { name: 'for_dict', template: '{% for k, v in items %}{{ k }}={{ v }}{% endfor %}', context: { items: { a: 1 } } },
  { name: 'for_dict_string_map', template: '{% for k, v in items %}{{ k }}={{ v }}{% endfor %}', context: { items: { map: 'not a function' } } },
];

async function test() {
  for (const t of templates) {
    try {
      const html = await nunjucks(t.template, t.context, { dev: true });
      console.log(`${t.name}: SUCCESS - html="${html}"`);
    } catch (err) {
      console.log(`${t.name}: ERROR - ${err.code || 'UNKNOWN'} - ${err.message}`);
    }
  }
}

test();