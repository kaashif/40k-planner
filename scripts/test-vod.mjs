import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const root = new URL('../public/vod/fowler-parry/', import.meta.url);
const read = name => JSON.parse(readFileSync(new URL(name, root)));
const data = read('analysis.json');
const manifest = read('frames.json');

test('checkpoints have ordered timestamps and distinct evidence categories', () => {
  let last = -1;
  for (const frame of data.checkpoints) {
    assert(frame.second > last && frame.second >= data.reviewStart && frame.second <= data.reviewEnd);
    last = frame.second;
    assert(frame.visible.length && frame.interpretation && frame.unknown && frame.alt);
    assert.equal(frame.score.length, 2);
    for (const report of frame.reported) assert(report.start < report.end);
    for (const pin of frame.pins) assert(pin.x >= 0 && pin.x <= 100 && pin.y >= 0 && pin.y <= 100);
  }
});
test('every published frame matches its provenance hash and source timestamp', () => {
  assert.equal(manifest.length, data.checkpoints.length);
  for (const frame of data.checkpoints) {
    const entry = manifest.find(item => item.second === frame.second);
    assert(entry);
    assert.equal(entry.file, `${String(frame.second).padStart(6, '0')}.jpg`);
    const bytes = readFileSync(new URL(entry.file, root));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256);
    assert.equal(entry.source, `https://www.youtube.com/watch?v=${data.videoId}&t=${frame.second}s`);
    assert.equal(entry.width / entry.height, 16 / 9);
    assert(bytes.length < 600000, 'Each evidence frame stays below 600 kB');
  }
});
test('queue links have explicit index provenance', () => {
  for (const game of data.queue) {
    assert.match(game.videoId, /^[\w-]{11}$/);
    assert(game.second >= 0);
    assert.equal(new URL(game.indexUrl).hostname, '40kvodindex.com');
  }
});
