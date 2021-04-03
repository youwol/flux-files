# Flux Files


<p>
    <a href="https://github.com/kefranabg/readme-md-generator/graphs/commit-activity" target="_blank">
        <img alt="Maintenance" src="https://img.shields.io/badge/Maintained%3F-yes-green.svg" />
    </a>
    <a href="https://github.com/kefranabg/readme-md-generator/blob/master/LICENSE" target="_blank">
        <img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-yellow.svg" />
    </a>
</p>

Collection of modules to work with files in Flux


## Installation, Build & Test 

To install the required dependencies:
```shell
yarn 
```

To build for development:
```shell
yarn build:dev
```

To build for production:
```shell
yarn build:prod
```

To test:
```shell
yarn test
```

To generate code documentation:
```shell
yarn doc
```

## Usage 

This collection of modules aims at working with files and folders in YouWol.
It is built above an abstract drive concept that provides handle to browse, read and write resources from 
multiple sources (local folder, youwol workspace, google drive, etc).

> This package only exposes a drive that enables to browse and use files/folders on your computer. 
> However, most of the modules exposed can work with others type of drive (e.g. YouWol drive, Google drive); 
> new ones can also be created (see developer documentation).


## Resources

Here is a list of interesting resources to work with a local filesystem from a browser:
-    [tutorial](https://web.dev/file-system-access/)
-    [specification](https://wicg.github.io/file-system-access/)
-    [API introduction](https://developer.mozilla.org/en-US/docs/Web/API/File_and_Directory_Entries_API/Introduction)

