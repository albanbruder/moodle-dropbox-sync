# moodle-dropbox-sync

Sync your Moodle files to your Dropbox.

:heavy_exclamation_mark: This script was tested only with the [moodle server](https://moodle.uni-weimar.de/) of the Bauhaus University Weimar (Germany).

## Getting started

```sh
# Clone or download Zip.
$ git clone https://github.com/albanbruder/moodle-dropbox-sync.git

# Install dependencies.
$ npm install
```
Copy .env file from .env.example and insert your environment variables.
```sh
$ cp .env.example .env
$ nano .env
```
Build and start the script.
```sh
$ npm run build
$ npm run start
```

## Development

```sh
$ npm run dev
```
