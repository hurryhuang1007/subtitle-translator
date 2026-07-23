import assert from 'node:assert/strict';

import { parseAss } from '../src/server/parser/ass';
import { protectAssTags, restoreAssTags } from '../src/server/parser/assTags';
import { parseSrt } from '../src/server/parser/srt';
import { parseSubtitleFileContent } from '../src/server/parser/parseSubtitle';

function testSrt() {
  const input = [
    '1',
    '00:00:01,000 --> 00:00:02,000',
    'Hello world',
    '',
    '2',
    '00:00:03,000 --> 00:00:04,500',
    'Line A',
    'Line B',
    '',
  ].join('\n');

  const parsed = parseSrt(input);
  assert.equal(parsed.format, 'srt');
  assert.equal(parsed.cues.length, 2);
  assert.equal(parsed.cues[0]?.text, 'Hello world');
  assert.equal(parsed.cues[1]?.text, 'Line A\nLine B');

  const rebuilt = parsed.rebuild(['你好世界', '第一行\n第二行']);
  assert.match(rebuilt, /1\n00:00:01,000 --> 00:00:02,000\n你好世界/);
  assert.match(rebuilt, /2\n00:00:03,000 --> 00:00:04,500\n第一行\n第二行/);
}

function testAssTags() {
  const raw = '{\\i1}Hello{\\i0} {\\an8}World';
  const { protectedText, tags } = protectAssTags(raw);
  assert.equal(tags.length, 3);
  assert.equal(restoreAssTags(protectedText, tags), raw);
}

function testAss() {
  const input = [
    '[Script Info]',
    'Title: Test',
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize',
    'Style: Default,Arial,20',
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
    'Dialogue: 0,0:00:01.00,0:00:02.00,Default,,0,0,0,,{\\i1}Hello{\\i0}\\NWorld',
    'Dialogue: 0,0:00:03.00,0:00:04.00,Default,,0,0,0,,Plain text',
  ].join('\n');

  const parsed = parseAss(input);
  assert.equal(parsed.format, 'ass');
  assert.equal(parsed.cues.length, 2);
  assert.match(parsed.cues[0]?.text ?? '', /Hello/);
  assert.match(parsed.cues[0]?.text ?? '', /World/);
  assert.equal(parsed.cues[1]?.text, 'Plain text');

  const rebuilt = parsed.rebuild(['你好', '纯文本']);
  assert.match(rebuilt, /\[Script Info\]/);
  assert.match(rebuilt, /\[V4\+ Styles\]/);
  assert.match(rebuilt, /\[Events\]/);
  assert.match(rebuilt, /Dialogue:.*\{\\i1\}你好\{\\i0\}\\N/);
  assert.match(rebuilt, /Dialogue:.*纯文本/);
  // 标签应保留
  assert.match(rebuilt, /\{\\i1\}/);
  assert.match(rebuilt, /\{\\i0\}/);
}

function testDetect() {
  const srt = parseSubtitleFileContent('a.srt', '1\n00:00:01,000 --> 00:00:02,000\nHi\n');
  assert.equal(srt.format, 'srt');

  const ass = parseSubtitleFileContent(
    'b.ass',
    '[Events]\nDialogue: 0,0:00:01.00,0:00:02.00,Default,,0,0,0,,Hi'
  );
  assert.equal(ass.format, 'ass');
  assert.equal(ass.cues.length, 1);
}

testSrt();
testAssTags();
testAss();
testDetect();
console.log('parser tests passed');
