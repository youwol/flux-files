
import { pack } from './main';
import { Flux, BuilderView,ModuleFlow,Pipe, Schema, Property, contract, expectSingle, Context, ModuleError} from '@youwol/flux-core'
import { map } from 'rxjs/operators';
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
 * The reader module allows to use read content from a file.
 * 
 * Documentation about its logic part as well as its inputs/outputs is included [[ModuleReader.Module | here]].
 * 
 * The configuration of the module is described [[ModuleReader.PersistentData|here]]
 */
export namespace ModuleReader {

    export enum Mode{
        BYTES = "bytes",
        TEXT = "text",
        JSON = "json",
        JAVASCRIPT = "javascript"
    }

     /**
     * Configuration of the Reader module. 
     * 
     */
    @Schema({
        pack: pack,
        description: "Persistent Data of FilesExplorer",
        namespace: ModuleReader,
    })
    export class PersistentData {

        /**
         * The reading mode  
         * 
         * This property specifies the formating of the file content before being send in this output:
         * -    'bytes' : the raw content of the file (bytes) is kept
         * -    'text' : the raw content of the file is read as text
         * -    'json' : the raw content of the file is parsed as a json structure
         * -    'javascript' : the raw content of the file is interpreted as a javascript content
         */
        @Property({ 
            description: "",
            enum: Object.values(Mode)
        })
        readonly mode: Mode

        
        constructor({ mode }:
            { mode?: Mode, 
            } = {}) {
                this.mode = mode != undefined ? mode : Mode.BYTES
        }
    }

    /**
     * The output of the module, combination of the read content (whose type depends on
     * [[PersistentData.mode]]) and the original file.
     */
    class Output{

        /**
         * The type is depending on [[PersistentData.mode]]:
         * -     'bytes' => Blob
         * -     'text' => string
         * -     'json' => JSON
         * -     'javascript' => any
         */
        readonly content : ArrayBuffer | string | JSON | any

        /**
         * The original file
         */
        readonly file: Interfaces.File

        constructor({content, file}:{content: Blob | string | JSON | any, file:Interfaces.File}){
            this.content = content
            this.file = file
        }
    }
     /**
     *  ## Abstract
     * 
     * The module take a file as input and return the parsed content in its output.
     * The output content can be directly interpreted into specific format 
     * using the configuration's mode property.
     * 
     * Typical use as downstream module is to read the content of a file selected by various modules
     * (e.g. [[ModuleExplorer]], [[ModuleFileSelector]]). As an upstream module, it can be used
     * to provide content for a text editor, or to provide parsed configuration file to a next module.
     * 
     * You can see it in action in some example of flux application listed [[@youwol/flux-files]]
     * 
     * ## Inputs/Outputs
     * 
     * The module include one input expected to get data consistent with a [[Interfaces.File]].
     * 
     * The module expose one output that propagate the file content. 
     * The actual type of the output is depending on the configuration's mode (see [[content$]])
     */
    @Flux({
        pack:           pack,
        namespace:      ModuleReader,
        id:             "Reader",
        displayName:    "Reader",
        description:    "This module is used to read the content of the file",
        resources: {
            'technical doc': `${pack.urlCDN}/dist/docs/modules/modulereader.html`
        }
    })
    @BuilderView({
        namespace:      ModuleReader,
        icon:           svgIcon
    })
    export class Module extends ModuleFlow {
        
        /**
         * Output pipe of the module
         */
        content$ : Pipe<Output>

        constructor(params){ 
            super(params)    

            this.addInput({
                id: 'file',
                description: "Read the content of the incoming file, eventually apply some formatting, and send the result in the output.",
                contract: contract({
                    description:"One required condition: to retrieve one file from the input",
                    requireds:{ 
                        file: expectSingle<Interfaces.File>( { when: expectations.file } )
                    }
                }),
                onTriggered: ({data, configuration, context}) => 
                    this.read( data.file, configuration, context )
            })
                 
            this.content$ = this.addOutput({id:"read"})             
        }

        read(file :  Interfaces.File , config : PersistentData, context : Context){
            
            let factory = {
                [Mode.BYTES]: file.read(),
                [Mode.TEXT]: file.readAsText(),
                [Mode.JSON]: file.readAsJson(),
                [Mode.JAVASCRIPT]: file.readAsText().pipe( map(text => new Function(text)() ) ),          
            }
            factory[config.mode]
            .subscribe( 
                (data) => {
                    this.content$.next( {data:new Output({content:data, file}), context}) 
                    context.end()
                },
                (error) =>{
                    context.error(
                        new ModuleError(this, "Can not read the input file"),
                        {
                            originalError: error,
                            file,
                            configuration: config
                        }
                    )
                }
            )             
        }
    }

}
