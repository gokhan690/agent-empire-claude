import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame } from '../src/engine/game.js';

// QA fix: the "safe" rank objective used to be titled "Sıralamada sonuncu olma" while asking for 4th place or better.
test('rank objectives: title and text name the same target place', () => {
  let seen = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const S = newGame({ seed, agentName: 'T', agencyName: 'T', archetype: 'mahalle', careerSeasons: 8 });
    for (const o of S.objectives.offered.filter((x) => x.kind === 'rank')) {
      seen++;
      assert.ok(o.rankTarget >= 1 && o.rankTarget <= 5);
      const place = o.rankTarget === 1 ? /1\. ol|1\./ : new RegExp(`${o.rankTarget}\\. sıra`);
      assert.match(o.title, place, o.title);
      assert.match(o.text, new RegExp(`${o.rankTarget}\\. sıra`), o.text);
      assert.doesNotMatch(o.title, /sonuncu olma/);
    }
  }
  assert.ok(seen > 0, 'no rank objective was ever offered in 60 seeds');
});
