import { FluxPack, IEnvironment } from '@youwol/flux-core'
import { AUTO_GENERATED } from '../auto_generated'

export function install(environment: IEnvironment){
    return environment.fetchStyleSheets(`@youwol/flux-files#${AUTO_GENERATED.version}~assets/style.css`)
}

export let pack = new FluxPack({
    ...AUTO_GENERATED,   
    ...{
        install
    }
})

