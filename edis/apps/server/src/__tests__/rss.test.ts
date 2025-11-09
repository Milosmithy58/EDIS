import { describe, expect, it } from 'vitest';
import { parseFeed } from '../adapters/news/rss';

const SAMPLE_XML = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>Sample Feed</title>
    <item>
      <title><![CDATA[Story 1]]></title>
      <link>https://example.com/story-1</link>
      <pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate>
      <enclosure url="https://example.com/story-1.jpg" type="image/jpeg" />
    </item>
    <item>
      <title>Story 2</title>
      <link>https://example.com/story-2</link>
      <media:content url="https://example.com/story-2.png" />
      <dc:date xmlns:dc="http://purl.org/dc/elements/1.1/">2024-01-02T12:00:00Z</dc:date>
    </item>
    <item>
      <title></title>
      <link></link>
    </item>
  </channel>
</rss>`;

describe('parseFeed', () => {
  it('parses items and metadata from XML', () => {
    const result = parseFeed(SAMPLE_XML, 'https://example.com/rss');

    expect(result.source).toBe('Sample Feed');
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({
      title: 'Story 1',
      url: 'https://example.com/story-1',
      imageUrl: 'https://example.com/story-1.jpg'
    });
    expect(result.items[1].imageUrl).toBe('https://example.com/story-2.png');
  });

  it('falls back to hostname when title missing', () => {
    const xml = SAMPLE_XML.replace('<title>Sample Feed</title>', '<title></title>');

    const result = parseFeed(xml, 'https://example.com/rss');

    expect(result.source).toBe('example.com');
  });

  it('ensures published date is ISO formatted', () => {
    const xml = SAMPLE_XML.replace('Mon, 01 Jan 2024 00:00:00 GMT', 'invalid');

    const result = parseFeed(xml, 'https://example.com/rss');

    expect(new Date(result.items[0].publishedAtISO).toString()).not.toBe('Invalid Date');
  });
});
