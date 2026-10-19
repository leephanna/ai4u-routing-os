import {readFile,stat} from 'node:fs/promises';
import {resolve} from 'node:path';
const path=resolve('www');
for(const f of ['index.html','vendor.js','fonts.css','supabase-persistence.js','supabase-config.js','native-links.js','ai4u-badge.png'])await stat(resolve(path,f));
const html=await readFile(resolve(path,'index.html'),'utf8');
if(/<script[^>]+src="https?:/i.test(html))throw Error('Remote script dependency detected');
if(/<link[^>]+href="https?:/i.test(html))throw Error('Remote stylesheet dependency detected');
if(!html.includes('vendor.js')||!html.includes('supabase-persistence.js'))throw Error('Missing bundled runtime');
console.log('PASS: core application files and runtime libraries are packaged locally');
