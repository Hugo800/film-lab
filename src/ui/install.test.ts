import { describe, expect, it } from 'vitest';
import { plattform } from './install';

const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1';
const IPHONE_CHROME =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/141.0.0.0 Mobile/15E148 Safari/604.1';
const IPHONE_INSTAGRAM =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 400.0.0.0 (iPhone17,1; iOS 18_6; de_DE)';
const IPHONE_WEBVIEW = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';
const MAC_SAFARI = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15';
const ANDROID_CHROME = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36';
const WINDOWS_CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';

describe('plattform', () => {
  it('erkennt Safari und Chrome am iPhone', () => {
    expect(plattform(IPHONE_SAFARI, 'iPhone', 5)).toBe('ios');
    expect(plattform(IPHONE_CHROME, 'iPhone', 5)).toBe('ios');
  });

  it('erkennt In-App-Browser am iPhone an der Kennung oder am fehlenden „Safari/“', () => {
    expect(plattform(IPHONE_INSTAGRAM, 'iPhone', 5)).toBe('ios-app');
    expect(plattform(IPHONE_WEBVIEW, 'iPhone', 5)).toBe('ios-app');
  });

  it('zählt das iPad, das sich als Mac meldet, zu iOS, den Mac ohne Touch nicht', () => {
    expect(plattform(MAC_SAFARI, 'MacIntel', 5)).toBe('ios');
    expect(plattform(MAC_SAFARI, 'MacIntel', 0)).toBe('desktop');
  });

  it('unterscheidet Android und PC', () => {
    expect(plattform(ANDROID_CHROME, 'Linux armv8l', 5)).toBe('android');
    expect(plattform(WINDOWS_CHROME, 'Win32', 0)).toBe('desktop');
  });
});
