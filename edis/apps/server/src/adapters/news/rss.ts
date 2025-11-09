import { fetchText } from '../../core/fetcher';
import { NewsDTO } from '../../core/types';

const ITEM_REGEX = /<item[\s\S]*?<\/item>/gi;
const ENTRY_REGEX = /<entry[\s\S]*?<\/entry>/gi;

const decodeCdata = (value: string): string =>
  value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1');

const decodeEntities = (value: string): string =>
  decodeCdata(value)
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'");

const extractTagValue = (source: string, tagName: string): string | undefined => {
  const regex = new RegExp(`<${tagName}(?:[^>]*)>([\\s\\S]*?)<\/${tagName}>`, 'i');
  const match = source.match(regex);
  if (!match) return undefined;
  return decodeEntities(match[1]).trim();
};

const extractAttribute = (source: string, tagName: string, attribute: string): string | undefined => {
  const regex = new RegExp(`<${tagName}[^>]*${attribute}="([^"]+)"[^>]*>`, 'i');
  const match = source.match(regex);
  if (!match) return undefined;
  return match[1].trim();
};

const toISODate = (value?: string): string => {
  if (!value) return new Date().toISOString();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString();
  }
  return parsed.toISOString();
};

const inferSource = (xml: string, feedUrl: string): string => {
  const channelMatch = xml.match(/<channel[\s\S]*?<\/channel>/i);
  if (channelMatch) {
    const title = extractTagValue(channelMatch[0], 'title');
    if (title) return title;
  }
  const feedMatch = xml.match(/<feed[\s\S]*?<\/feed>/i);
  if (feedMatch) {
    const title = extractTagValue(feedMatch[0], 'title');
    if (title) return title;
  }
  try {
    return new URL(feedUrl).host || 'RSS Feed';
  } catch (error) {
    return 'RSS Feed';
  }
};

const parseItems = (xml: string): string[] => {
  const rssItems = xml.match(ITEM_REGEX) ?? [];
  if (rssItems.length > 0) {
    return rssItems;
  }
  return xml.match(ENTRY_REGEX) ?? [];
};

const resolveLink = (source: string): string | undefined => {
  const link = extractTagValue(source, 'link');
  if (link) return link;
  const atomLink = extractAttribute(source, 'link', 'href');
  return atomLink;
};

const resolveImage = (source: string): string | undefined => {
  const enclosure = extractAttribute(source, 'enclosure', 'url');
  if (enclosure) return enclosure;
  const mediaContent = extractAttribute(source, 'media:content', 'url');
  if (mediaContent) return mediaContent;
  const mediaThumbnail = extractAttribute(source, 'media:thumbnail', 'url');
  if (mediaThumbnail) return mediaThumbnail;
  return undefined;
};

const resolveDate = (source: string): string | undefined => {
  const isoDate = extractTagValue(source, 'updated') ?? extractTagValue(source, 'published');
  if (isoDate) return isoDate;
  const pubDate =
    extractTagValue(source, 'pubDate') ??
    extractTagValue(source, 'dc:date') ??
    extractTagValue(source, 'date');
  return pubDate;
};

export const parseFeed = (xml: string, feedUrl: string): NewsDTO => {
  const source = inferSource(xml, feedUrl);
  const items = parseItems(xml)
    .map((raw) => {
      const title = extractTagValue(raw, 'title');
      const url = resolveLink(raw);
      if (!title || !url) {
        return null;
      }
      return {
        title,
        url,
        source,
        publishedAtISO: toISODate(resolveDate(raw)),
        imageUrl: resolveImage(raw)
      };
    })
    .filter((item): item is NewsDTO['items'][number] => Boolean(item));

  return {
    items,
    total: items.length,
    source
  };
};

export const getNewsFromFeed = async (feedUrl: string): Promise<NewsDTO> => {
  const xml = await fetchText(feedUrl);
  return parseFeed(xml, feedUrl);
};
