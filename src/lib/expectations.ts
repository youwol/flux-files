import { expect, expectAnyOf, expectAttribute } from "@youwol/flux-core";
import { Interfaces } from "./implementation/interfaces";


let realDrive = expect({ 
    description: "drive",
    when:(data) => data instanceof Interfaces.Drive 
})

export let drive = expectAnyOf<Interfaces.Drive>({
    description: 'drive',
    when: [
        realDrive,
        expectAttribute({name:'drive', when:realDrive})
    ]
})

let realFile = expect<Interfaces.File>({ 
    description: "file",
    when:(data) => data instanceof Interfaces.File 
})

export let file = expectAnyOf<Interfaces.File>({
    description: 'file',
    when: [
        realFile,
        expectAttribute({name:'file', when:realFile})
    ]
})
