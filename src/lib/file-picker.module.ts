
import { pack } from './main';
import { Property, Flux, BuilderView,ModuleFlow,Pipe, Schema, contract, expectSingle, Context} from '@youwol/flux-core'
import { Interfaces } from './implementation/interfaces';
import * as expectations from './expectations';

//Icons made by <a href="https://www.flaticon.com/authors/good-ware" title="Good Ware">Good Ware</a> from <a href="https://www.flaticon.com/" title="Flaticon"> www.flaticon.com</a>
let svgIcon = `
<path d="M451.52,221.76h-35.2c-4.21-44.47-43.673-77.107-88.143-72.897c-38.644,3.658-69.239,34.254-72.897,72.897h-51.04    c-4.21-44.47-43.673-77.107-88.143-72.897c-38.644,3.658-69.239,34.254-72.897,72.897H8c-4.418,0-8,3.582-8,8s3.582,8,8,8h35.2    c4.21,44.47,43.673,77.107,88.143,72.897c38.644-3.658,69.239-34.254,72.897-72.897h51.12c4.21,44.47,43.673,77.107,88.143,72.897    c38.644-3.658,69.239-34.254,72.897-72.897h35.12c4.418,0,8-3.582,8-8S455.938,221.76,451.52,221.76z M123.68,294.72h-0.16    c-35.876-0.088-64.888-29.243-64.8-65.12c0.088-35.876,29.243-64.888,65.12-64.8c35.814,0.088,64.8,29.146,64.8,64.96    C188.64,265.636,159.556,294.72,123.68,294.72z M335.84,294.72h-0.16c-35.876-0.088-64.888-29.243-64.8-65.12    c0.088-35.876,29.243-64.888,65.12-64.8c35.814,0.088,64.8,29.146,64.8,64.96C400.8,265.636,371.716,294.72,335.84,294.72z"/>
<path d="M132.56,178.96L132.56,178.96c-4.418,0-8,3.582-8,8s3.582,8,8,8c14.536,0,26.32,11.784,26.32,26.32c0,4.418,3.582,8,8,8    s8-3.582,8-8C174.88,197.907,155.933,178.96,132.56,178.96z"/>
<path d="M344.24,178.96L344.24,178.96c-4.418,0-8,3.582-8,8s3.582,8,8,8c14.536,0,26.32,11.784,26.32,26.32c0,4.418,3.582,8,8,8    s8-3.582,8-8C386.56,197.907,367.613,178.96,344.24,178.96z"/>
`
/**
 * ## Abstract
 * 
 * The file picker module allows to select a file from a particular drive.
 * 
 * Documentation about its logic part as well as its inputs/outputs is included [[ModuleFilePicker.Module | here]].
 * 
 * The configuration of the module is described [[ModuleFilePicker.PersistentData|here]]
 */
export namespace ModuleFilePicker {

    /**
     * The persistent configuration
     * 
     * The configuration allows to provide the fileId to select
     */
    @Schema({
        pack: pack,
        description: "Persistent Data of FilesExplorer",
        namespace:      ModuleFilePicker,
    })
    export class PersistentData {

        /**
         * The id of the file to pick
         */
        @Property({ description: "id of the file" })
        readonly fileId : string

        constructor( {fileId} : {fileId?: string} = {}) {
            this.fileId = fileId ? fileId : ""
        }
    }

    
    /**
     *  ## Abstract
     * 
     * The module take a drive as input, get a fileId from the configuration,
     *  and return the selected in its output.
     * 
     * Typical use as downstream module is to read pick a file after a drive selection module
     * (e.g. [[ModuleLocalDrive]]). As an upstream module, it can be used
     * before a [[ModuleReader]] to provide the content of a particular file to your application.
     *  
     * You can see it in action in some example of flux applications listed [here](../index.html).
     * 
     * ## Inputs/Outputs
     * 
     * The module include one input expected to get data consistent with a [[Interfaces.Drive]].
     * 
     * The module expose one output that propagate the selected file. 
     */
    @Flux({
        pack:           pack,
        namespace:      ModuleFilePicker,
        id:             "FilePicker",
        displayName:    "File Picker",
        description:    "This module allows to select a file from an id and a drive",
        resources: {
            'technical doc': `${pack.urlCDN}/dist/docs/modules/modulelocaldrive.html`
        }
    })
    @BuilderView({
        namespace:      ModuleFilePicker,
        icon:           svgIcon
    })
    export class Module extends ModuleFlow {
        
        /**
         * Output of the module: a file
         * 
         */
        file$ : Pipe<Interfaces.File>

        constructor(params){ 
            super(params)    

            this.addInput({
                id: 'drive',
                description: "pick the file from its fileId using the incoming drive",
                contract: contract({
                    description:"One required condition: to retrieve one drive from the input",
                    requireds:{ 
                        drive: expectSingle<Interfaces.Drive>( { when: expectations.drive } )
                    }
                }),
                onTriggered: ({data, configuration, context}) => 
                    this.select( data.drive, configuration, context )
            })

            this.file$ = this.addOutput({id:"file"}) 
        }

        select(drive :  Interfaces.Drive , config : PersistentData, context : Context){
            
            drive.getFile(config.fileId)
            .subscribe( 
                (file: Interfaces.File) => 
                    this.file$.next({data: file, context}),
                (error) =>   
                    context.error( 
                        new Error('failed to retrieve a file from drive'), 
                        {
                            originalError:error,
                            drive,
                            fileId: config.fileId
                        }) 
            )
        }

    }

}
