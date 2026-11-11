import test from 'node:test';
import assert from 'node:assert/strict';

import { joinAdjacentImageLines } from '../src/tidy';

test('adjacent image-only lines are merged into one', () => {
	const input = ['![[a.png|227]]', '![[b.png|477]]', '![[c.png]]', '![[d.png]]', '', '## 下一节'].join('\n');
	const { content, joined } = joinAdjacentImageLines(input);
	assert.equal(joined, 3);
	assert.equal(content, ['![[a.png|227]]![[b.png|477]]![[c.png]]![[d.png]]', '', '## 下一节'].join('\n'));
});

test('a note that already has one image line is untouched', () => {
	const input = '![[a.png]]![[b.png]]';
	const { content, joined } = joinAdjacentImageLines(input);
	assert.equal(joined, 0);
	assert.equal(content, input);
});

test('prose between images prevents merging', () => {
	const input = ['![[a.png]]', '', '一些文字', '', '![[b.png]]'].join('\n');
	const { content, joined } = joinAdjacentImageLines(input);
	assert.equal(joined, 0);
	assert.equal(content, input);
});

test('frontmatter is never touched', () => {
	const input = ['---', 'image-width: 400', '---', '![[a.png]]', '![[b.png]]'].join('\n');
	const { content, joined } = joinAdjacentImageLines(input);
	assert.equal(joined, 1);
	assert.ok(content.startsWith('---\nimage-width: 400\n---\n'));
	assert.ok(content.endsWith('![[a.png]]![[b.png]]'));
});

test('padded lines keep the embeds but drop the padding', () => {
	const { content, joined } = joinAdjacentImageLines('  ![[a.png]]  \n\t![[b.png]]\t');
	assert.equal(joined, 1);
	assert.equal(content, '![[a.png]]![[b.png]]');
});

test('a line mixing an image with text is left alone', () => {
	const input = '![[a.png]] 说明文字\n![[b.png]]';
	const { joined, content } = joinAdjacentImageLines(input);
	assert.equal(joined, 0);
	assert.equal(content, input);
});

test('markdown-style images are not treated as wiki embeds', () => {
	const input = '![](a.png)\n![](b.png)';
	const { joined } = joinAdjacentImageLines(input);
	assert.equal(joined, 0);
});
