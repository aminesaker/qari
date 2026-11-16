// Les modèles de reconnaissance vocale (.bin) sont embarqués comme assets.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push('bin');

module.exports = config;
