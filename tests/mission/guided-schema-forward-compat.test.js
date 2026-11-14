"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
test("Schema initializer never re-applies historical Step 2 limits to saved Step 3 missions",()=>{
 const source=fs.readFileSync(path.join(__dirname,"../../lib/billing/db.js"),"utf8");
 const start=source.indexOf('CREATE TABLE IF NOT EXISTS ai4u_private.router_guided_missions');
 const end=source.indexOf('REVOKE ALL ON TABLE ai4u_private.router_guided_missions',start);
 assert.ok(start>=0&&end>start);
 const segment=source.slice(start,end);
 assert.match(segment,/ADD CONSTRAINT router_guided_missions_step_index_check CHECK\(step_index BETWEEN 0 AND 3\)/);
 assert.match(segment,/ADD CONSTRAINT router_guided_missions_status_check CHECK\(status IN \('awaiting_user','awaiting_route_review','awaiting_setup','awaiting_site_review','blocked'\)\)/);
 assert.doesNotMatch(segment,/ADD CONSTRAINT router_guided_missions_step_index_check CHECK\(step_index BETWEEN 0 AND 2\)/);
 assert.doesNotMatch(segment,/ADD CONSTRAINT router_guided_missions_status_check CHECK\(status IN \('awaiting_user','awaiting_route_review','awaiting_setup','blocked'\)\)/);
 const dropStep=segment.indexOf('DROP CONSTRAINT IF EXISTS router_guided_missions_step_index_check');
 const addStep=segment.indexOf('ADD CONSTRAINT router_guided_missions_step_index_check');
 assert.ok(dropStep>=0&&addStep>dropStep);
});
