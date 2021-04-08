import { MockEnvironment } from "@youwol/flux-core"
import { install } from "../lib/main"

console.log = () =>{}

let environment = new MockEnvironment()

test('install', (done) => {
    
    install(environment).subscribe( (d) => {
        expect(d).toEqual(["@youwol/flux-files#0.0.0~assets/style.css"])
        done()
    })
})