import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
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
  assert(manifest.length >= data.checkpoints.length);
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

for (const id of ['fowler-parry', 'fowler-power', 'terroxer-allot']) {
  test(`${id}: chronological frames and plausible diagram coordinates`, () => {
    const dir = new URL(`../public/vod/${id}/`, import.meta.url);
    const game = JSON.parse(readFileSync(new URL('game.json', dir)));
    const provenance = JSON.parse(readFileSync(new URL('frames.json', dir)));
    assert.equal(game.id, id);
    assert(game.frames.length >= 5 && game.frames.length <= 16);
    assert(game.frames.some(f => f.board?.groups.some(g => g.key === 'magnus')));
    let last = -1;
    for (const frame of game.frames) {
      assert(frame.second > last);
      last = frame.second;
      assert(frame.alt && frame.label);
      assert(existsSync(new URL(frame.image, dir)));
      const source = provenance.find(p=>p.file === frame.image && p.second === frame.second);
      assert(source);
      assert.equal(createHash('sha256').update(readFileSync(new URL(frame.image, dir))).digest('hex'), source.sha256);
      assert.equal(source.source, `https://www.youtube.com/watch?v=${game.videoId}&t=${frame.second}s`);
      if (frame.score) assert.equal(frame.score.length, 2);
      if (frame.board) {
        const keys = frame.board.groups.map(g=>g.key).filter(Boolean);
        assert.equal(keys.length, new Set(keys).size);
        for (const group of frame.board.groups) {
          assert(group.x >= 0 && group.x <= 100 && group.y >= 0 && group.y <= 100);
          assert(['ts','ec','unknown'].includes(group.side));
          for (const point of group.trail ?? []) {
            assert(point.second < frame.second);
            assert(point.x >= 0 && point.x <= 100 && point.y >= 0 && point.y <= 100);
          }
        }
      }
    }
    assert(game.frames.map(f=>f.caption?.text ?? '').join(' ').trim().split(/\s+/).length <= 25);
    for (const entry of provenance) {
      assert.equal(createHash('sha256').update(readFileSync(new URL(entry.file, dir))).digest('hex'), entry.sha256);
    }
    assert(game.tracking.reviewedSeconds.length > game.frames.length);
  });
}
