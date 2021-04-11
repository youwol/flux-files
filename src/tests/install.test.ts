import { MockEnvironment } from "@youwol/flux-core"
import { AUTO_GENERATED } from "../auto_generated"
import { install } from "../lib/main"

console.log = () =>{}

let environment = new MockEnvironment()

test('install', (done) => {
    
    install(environment).subscribe( (d) => {
        expect(d).toEqual([`@youwol/flux-files#${AUTO_GENERATED.version}~assets/style.css`])
        done()
    })
})