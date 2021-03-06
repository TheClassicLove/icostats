/* eslint-disable no-console */
import winston from 'winston';
import has from 'lodash/has';
import { normalize as normalizeICO } from 'lib/icos';
import icoData from 'lib/ico-data';
import { fetchETHPrice, fetchBTCPrice } from 'shared/lib/exchanges/gdax';
import { cache } from 'app';
import PriceHistory from 'models/price-history';
import * as shapeshift from 'shared/lib/shapeshift';

export default async function icos() {
  const priceHistories = await PriceHistory.find().lean().exec();
  const pricesBySymbol = priceHistories.reduce((obj, model) => ({
    ...obj,
    [model.symbol]: model.latest
  }), {});
  // when new tokens are added, it takes a bit for their price history to
  // be added to the db. So just leave that token out for now if so.
  const validICOs = icoData.filter(ico => has(pricesBySymbol, ico.symbol));
  const results = validICOs.map(data => ({
    ...data,
    ...pricesBySymbol[data.symbol],
    id: data.id
  }));

  // get shapeshift info
  let shapeshiftCoins = cache.get('shapeshiftCoins');

  if (!shapeshiftCoins) {
    try {
      shapeshiftCoins = await shapeshift.getCoins();
    } catch (err) {
      winston.error('Failed to fetch shapeshift coins: %s', err.message);
    }
  }

  // Get the current ETH price
  let ethPrice = cache.get('ethPrice');
  let btcPrice = cache.get('btcPrice');

  if (!ethPrice) {
    try {
      ethPrice = await fetchETHPrice();
    } catch (e) {
      const ticker = tickers.find(t => t.symbol === 'ETH');

      ethPrice = ticker.price_usd;
      winston.info('Fetched fallback ETH price (%s) from db.', ethPrice);
    }
    cache.set('ethPrice', ethPrice);
  }

  if (!btcPrice) {
    try {
      btcPrice = await fetchBTCPrice();
    } catch (e) {
      const ticker = tickers.find(t => t.symbol === 'BTC');

      btcPrice = ticker.price_usd;
      winston.info('Fetched fallback BTC price (%s) from db.', btcPrice);
    }
    cache.set('btcPrice', btcPrice);
  }

  return results.map(ico =>
    normalizeICO(ico, ethPrice, btcPrice, shapeshiftCoins)
  );
}
