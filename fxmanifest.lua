name 'ai-voice'
author 'TGIANN'
version '0.1.1' -- x-release-please-version
license 'GPL-3.0-only'
description 'Proximity voice, radio and phone calls on FiveM Legacy (Mumble) and FiveM Enhanced (server voice channels), stands in for pma-voice'
repository 'https://github.com/aifivem/ai-voice'
fx_version 'cerulean'
game 'gta5'
node_version '22'

client_script 'dist/client.js'
server_script 'dist/server.js'


dependencies {
	'/onesync',
	'ai-core',
}

files {
	'locales/*.json',
	'data/settings.json',
	'data/channels.json',
}
provide 'pma-voice'
provide 'mumble-voip'
provide 'tokovoip'
provide 'toko-voip'
provide 'tokovoip_script'
