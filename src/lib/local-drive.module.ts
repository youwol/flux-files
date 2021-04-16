import "reflect-metadata";
import { pack } from './main';
import { Flux,BuilderView, ModuleFlux, Pipe, Schema, Property } from "@youwol/flux-core"
import { render, VirtualDOM } from '@youwol/flux-view'
import { Modal } from '@youwol/fv-group'
import { Button } from '@youwol/fv-button'
import { from } from 'rxjs';
import { map, mergeMap, take } from 'rxjs/operators';
import {LocalDrive} from './implementation/local-drive';

// Icons made by <a href="https://www.freepik.com" title="Freepik">Freepik</a> from <a href="https://www.flaticon.com/" title="Flaticon">www.flaticon.com</a></div>
let svgIcon = `
<path xmlns="http://www.w3.org/2000/svg" d="M108.73,73.749v2.422c0,6.065-4.935,11-11,11h-7.775V62.749h7.775C103.796,62.749,108.73,67.684,108.73,73.749z   M143.178,62.749h-7.775v24.422h7.775c6.065,0,11-4.935,11-11v-2.422C154.178,67.684,149.244,62.749,143.178,62.749z   M186.761,15.352v144.456v9.125v14.4c0,8.465-6.887,15.352-15.352,15.352H27.277c-8.465,0-15.352-6.887-15.352-15.352v-14.4v-9.125  V15.352C11.925,6.887,18.811,0,27.277,0h144.132C179.874,0,186.761,6.887,186.761,15.352z M125.404,92.171c0,2.761,2.239,5,5,5  h12.775c11.58,0,21-9.42,21-21v-2.422c0-11.58-9.42-21-21-21h-12.775c-2.761,0-5,2.239-5,5V92.171z M79.955,92.171  c0,2.761,2.239,5,5,5H97.73c11.58,0,21-9.42,21-21v-2.422c0-11.58-9.42-21-21-21H84.955c-2.761,0-5,2.239-5,5V92.171z   M34.507,92.171c0,2.761,2.239,5,5,5s5-2.239,5-5V79.96h18.775v12.211c0,2.761,2.239,5,5,5s5-2.239,5-5V57.749c0-2.761-2.239-5-5-5  s-5,2.239-5,5V69.96H44.507V57.749c0-2.761-2.239-5-5-5s-5,2.239-5,5V92.171z M176.761,159.808c0-2.951-2.401-5.352-5.352-5.352  H27.277c-2.951,0-5.352,2.401-5.352,5.352v23.525c0,2.951,2.401,5.352,5.352,5.352h144.132c2.951,0,5.352-2.401,5.352-5.352V159.808  z M41.086,166.571h-0.254c-2.761,0-5,2.239-5,5s2.239,5,5,5h0.254c2.761,0,5-2.239,5-5S43.847,166.571,41.086,166.571z   M159.542,166.571h-12.326c-2.761,0-5,2.239-5,5s2.239,5,5,5h12.326c2.761,0,5-2.239,5-5S162.303,166.571,159.542,166.571z"/>
`

/**
 * ## Abstract
 * 
 * The local drive module allows to use files/folders from your computer in your application.
 * 
 * Documentation about its logic part as well as its inputs/outputs is included [[ModuleLocalDrive.Module | here]].
 * 
 * The configuration of the module is described [[ModuleLocalDrive.PersistentData|here]]
 */
export namespace ModuleLocalDrive {

    /**
     * The persistent configuration
     * 
     */
    @Schema({
        pack: pack
    })
    export class PersistentData {

        /**
         * The id of the drive. 
         * 
         * When a drive is added in a scene (e.g. module Explorer), only the last drive inserted
         * for a particular driveId is actually included.
         */
        @Property({ 
            description: "id of the drive"
        })
        readonly driveId: string

        
        /**
         * The displayed name of the drive.
         */
         @Property({ 
            description: "name of the drive"
        })
        readonly driveName: string

        constructor( { driveId, driveName}:
                     { driveId?: string, driveName?:string} = {}){

            this.driveId = driveId != undefined ? driveId : "local-drive"
            this.driveName = driveName != undefined ? driveName : "local-drive"
        }
    }
    

    /**
     *  ## Abstract
     * 
     * The local drive module expose only the output [[drive$]] that convey the created drive.
     * 
     * It is typically used to connect to downstream module like [[ModuleExplorer]] or [[ModuleFileSelector]].
     * 
     * > Because of security concerns, it is required that the user performs an explicit action
     * > to trigger selection of a local folder. 
     * > Hence, at creation, the module popup a dialog-box to pick a folder and authorize the browser accessing its content.
     * > Also, sensitive folder can not be picked (e.g. systems folders).
     * 
     */
    @Flux({
        pack: pack,
        namespace: ModuleLocalDrive,
        id: "LocalDrive",
        displayName: "Local Drive",
        description: "A module to connect to a local folder of the computer for fetching/browsing files.",
        resources: {
            'technical doc': `${pack.urlCDN}/dist/docs/modules/lib_local_drive_module.modulelocaldrive.html`
        }
    })
    @BuilderView({
        namespace: ModuleLocalDrive,
        icon: svgIcon
    })
    export class Module extends ModuleFlux {

        /**
         * The drive output
         * 
         * Whenever this module is created and the user authorize to read/write content, 
         * a new drive with its root as the folder selected is send there.
         * 
         * Hereafter, all ids of files/folders are the path relative to the drive's root.
         */
        drive$  : Pipe<LocalDrive>
        
        constructor(params) {
            super(params)

            this.drive$  = this.addOutput({id:"drive"})
            let modalState = new Modal.State()

            
            let modalView = new Modal.View({
                state:modalState,
                contentView: (state) => modalContent(this.configuration.title, state)
            } as any)
            
            let modalDiv = render(modalView)
            document.body.appendChild(modalDiv)      

            modalState.cancel$.pipe(take(1)).subscribe( () => modalDiv.remove() )
            modalState.ok$.pipe(
                take(1),
                mergeMap( () => from(window['showDirectoryPicker']()) ),
                map( handle => {
                    let config = this.getPersistentData<PersistentData>()
                    return new LocalDrive(config.driveId, config.driveName, handle) 
                })
            )
            .subscribe(
                drive => { 
                    modalDiv.remove()
                    this.drive$.next({data:drive}) 
                }
            )
        }  
    }

    function modalContent(moduleTitle: string, modalState: Modal.State){

        let okBttn = new Button.View({
            state: new Button.State(),
            contentView: () => ({ innerText: 'Proceed'}),
            class: "fv-btn fv-btn-primary fv-bg-focus mr-2"
        } as any)

        let cancelBttn = Button.simpleTextButton('Cancel')
        okBttn.state.click$.subscribe( () => modalState.ok$.next())
        cancelBttn.state.click$.subscribe( () => modalState.cancel$.next())

        return {
            id: 'yw-flux-files-local-drive-modal',
            class: 'fv-bg-background p-3 fv-text-primary rounded d-flex flex-column h-100 mx-2',
            style:{ height:'50vh', width:'90vw', 'max-width':'800px'},
            children: [
                {
                    tag: 'h2',
                    class:'mx-auto fv-text-focus',
                    innerText: moduleTitle
                },
                {   tag:'p',
                    innerText: `The local-drive module required to read/write files on your computer.`
                },
                {   tag:'p',
                    innerText: `For security reason you will be prompted by your browser to provide authorisation to read/write file to your computer.`
                },
                {   
                    class:'d-flex mt-2',
                        children:[
                            okBttn,
                            cancelBttn
                        ]
                }
            ]
            } as VirtualDOM 
    }

}
