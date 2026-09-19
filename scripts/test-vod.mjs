import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
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

const gameIds = readdirSync(new URL('../public/vod/', import.meta.url), {withFileTypes:true}).filter(d=>d.isDirectory()).map(d=>d.name);
for (const id of gameIds) {
  test(`${id}: chronological frames and plausible diagram coordinates`, () => {
    const dir = new URL(`../public/vod/${id}/`, import.meta.url);
    const game = JSON.parse(readFileSync(new URL('game.json', dir)));
    const provenance = JSON.parse(readFileSync(new URL('frames.json', dir)));
    assert.equal(game.id, id);
    assert(['on-board','reserve','not-in-list','unknown'].includes(game.deployment.terminators));
    assert(game.deployment.items.length > 0);
    for (const item of game.deployment.items) {
      assert(item.unit && item.status && item.evidence && item.sources.length);
      for (const source of item.sources) assert.equal(new URL(source.url).protocol, 'https:');
    }
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
    for (const frame of game.frames) assert(game.tracking.reviewedSeconds.includes(frame.second));
    if (game.lessons) {
      assert(game.date && game.edition && game.editionSource);
      assert.equal(new URL(game.editionSource).protocol, 'https:');
      for (const lesson of game.lessons) {
        assert(lesson.text && lesson.seconds.length);
        for (const second of lesson.seconds) assert(game.frames.some(f=>f.second===second));
      }
      for (const frame of game.frames) {
        for (const category of ['visible','interpretation','unknown','confidence']) assert(frame.evidence[category]);
      }
      for (const list of game.lists) {
        assert(list.player && list.units.length && list.notes);
        assert.equal(new URL(list.source).protocol, 'https:');
      }
    }
  });
}

test('search inventory links analysed games to existing evidence and keeps score types explicit', () => {
  const inventory = JSON.parse(readFileSync(new URL('../public/vod/search-2026-09-19.json', import.meta.url)));
  assert.equal(inventory.searchedOn, '2026-09-19');
  for (const game of inventory.games) {
    assert.equal(new URL(game.indexUrl).hostname, '40kvodindex.com');
    assert.equal(new URL(game.videoUrl).hostname, 'www.youtube.com');
    assert(['team points','game points'].includes(game.scoreType));
    if (game.localReview) {
      const reviewed = JSON.parse(readFileSync(new URL(`../public/vod/${game.localReview}`, import.meta.url)));
      assert.equal(reviewed.videoId, new URL(game.videoUrl).searchParams.get('v'));
    } else assert.equal(game.reviewStatus, 'source metadata only');
  }
});

test('reserve tally excludes lists without Terminators and distinguishes reserve from embarked', () => {
  const games = ['fowler-parry','fowler-power','terroxer-allot'].map(id=>JSON.parse(readFileSync(new URL(`../public/vod/${id}/game.json`, import.meta.url))));
  assert.deepEqual(games.map(g=>g.deployment.terminators), ['on-board','reserve','not-in-list']);
  for (const game of games.slice(0,2)) assert(game.deployment.items.find(i=>i.unit==='Two Rubric units').status.startsWith('Embarked'));
  assert(games[0].frames.some(f=>f.second===2700));
});

for (const id of gameIds) {
  test(`${id}: matched terrain has pinned provenance and correct PNG dimensions`, () => {
    const dir = new URL(`../public/vod/${id}/`, import.meta.url);
    const {terrainLayout: layout} = JSON.parse(readFileSync(new URL('game.json', dir)));
    assert.equal(layout.confidence, 'Likely visual match');
    assert.match(layout.sourceCommit, /^[a-f0-9]{40}$/);
    assert(layout.sourceUrl.includes(layout.sourceCommit));
    assert(layout.evidence && layout.note);
    const bytes = readFileSync(new URL(`../public${layout.image}`, import.meta.url));
    assert.equal(bytes.subarray(1,4).toString(), 'PNG');
    assert.equal(bytes.readUInt32BE(16), layout.width);
    assert.equal(bytes.readUInt32BE(20), layout.height);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), layout.sha256);
  });
}
