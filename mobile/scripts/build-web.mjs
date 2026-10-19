import { mkdir, copyFile, readFile, writeFile, cp } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { build } from 'esbuild';
const root=resolve('..'), out=resolve('www');
await mkdir(out,{recursive:true});
let html=await readFile(join(root,'index.html'),'utf8');
html=html.replace(/<link rel="preconnect" href="https:\/\/fonts.googleapis.com">\s*/g,'')
.replace(/<link rel="preconnect" href="https:\/\/fonts.gstatic.com" crossorigin>\s*/g,'')
.replace(/<link href="https:\/\/fonts.googleapis.com\/css2[^>]*>\s*/g,'<link rel="stylesheet" href="fonts.css">\n')
.replace(/<script src="https:\/\/cdn.jsdelivr.net\/npm\/chart.js[^>]*><\/script>/g,'')
.replace(/<script src="https:\/\/cdn.jsdelivr.net\/npm\/@supabase\/supabase-js[^>]*><\/script>/g,'<script src="vendor.js"></script>')
.replace(/<script src="supabase-config.js" onerror="void 0"><\/script>/g,'<script src="supabase-config.js"></script>');
html=html.replace('</body>','<script src="native-links.js"></script>\n</body>');
await writeFile(join(out,'index.html'),html);
await copyFile(join(root,'ai4u-badge.png'),join(out,'ai4u-badge.png'));
await copyFile(join(root,'supabase-persistence.js'),join(out,'supabase-persistence.js'));
await copyFile(resolve('scripts/native-links.js'),join(out,'native-links.js'));
// Supabase is opt-in and never bundles project keys or private credentials.
await writeFile(join(out,'supabase-config.js'),'window.AI4U_SUPABASE_CONFIG = {};\n');
await build({entryPoints:[resolve('scripts/vendor-entry.mjs')],outfile:join(out,'vendor.js'),bundle:true,format:'iife',platform:'browser',target:'es2020',minify:true});
const fonts=[
  ['orbitron','latin-400-normal.woff2'],['orbitron','latin-700-normal.woff2'],
  ['inter','latin-400-normal.woff2'],['inter','latin-700-normal.woff2'],
  ['jetbrains-mono','latin-400-normal.woff2']
];
await mkdir(join(out,'fonts'),{recursive:true});
let css='';
for(const [family,file] of fonts){
 const src=resolve('node_modules','@fontsource',family,'files',family+'-'+file);
 const dest=join(out,'fonts',family+'-'+file);
 await copyFile(src,dest);
 const display=family==='orbitron'?'Orbitron':family==='inter'?'Inter':'JetBrains Mono';
 const weight=file.includes('700')?700:400;
 css+=`@font-face{font-family:"${display}";font-style:normal;font-weight:${weight};font-display:swap;src:url("fonts/${family}-${file}") format("woff2");}\n`;
}
await writeFile(join(out,'fonts.css'),css);
console.log('Bundled local web assets:',out);
