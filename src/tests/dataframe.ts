import { combineLatest, forkJoin, from, range } from "rxjs";
import { map, mergeMap, reduce, switchMap } from "rxjs/operators";


class Dataframe{

    constructor(a: any){}
    
}
class Serie<T>{
    constructor(a: any){}
}
function myAlgoFunction(){}

function computeStep1(){}
function computeStep2(){}

var WorkersEnvironment;


function createSerie<T>( { Type, rowsCount, itemSize, shared, userData, transfertPolicy}: { Type, rowsCount, itemSize, shared, userData?, transfertPolicy?} ){
    let values = new Type(new ArrayBuffer(rowsCount * itemSize * Type.BYTES_PER_ELEMENT ))
    return new Serie<T>( {values, userData})
}


let df = new Dataframe(
    { 
        index: range(0, 512),
        columns:{
            a: createSerie({ Type:Float32Array, rowsCount:100, itemSize:3, shared: true}),
            b: createSerie({ Type:Int32Array, rowsCount:100, itemSize:3, shared: false})
        }, 
        userData:{
            id: 'dataframe0'
        }
    }
)

let workersEnv = new WorkersEnvironment({
    dependencies: {
        bundles: {
            '@youwol/kepler':'0.x'
        },
        javascripts:{
            arche: 'cdn/arche/arche.js'
        },
        functions:{
            myAlgoFunction
        } 
    },
    poolSize:6
})

let computeRequest$ // something that emit request to compute

// https://stackoverflow.com/questions/33353869/rxjs-observable-performing-cleanup-when-the-last-subscription-is-disposed
// https://stackoverflow.com/questions/30500883/javascript-web-worker-close-vs-terminate#:~:text=If%20you%20create%20a%20worker,call%20the%20close()%20method.

let computeTasks = [/*...*/]
forkJoin([
    workersEnv.schedule({
        execute: computeStep1,
        dataframes: [df]
    }),
    // scenario where we want to cancel a previous scheduled task when a new computeRequest$ arrives
    computeRequest$.pipe(
        switchMap( request => workersEnv.schedule({
            execute: computeStep2,
            dataframes: [df]
            })
        )
    ),
    from(computeTasks).pipe(
        mergeMap( task => workersEnv.schedule(/*...*/)),
        reduce( (acc,e) => acc.concat(e), [])
    )
]).subscribe( ([resultStep1, resultStep2, tasksResults]) => {
    console.log(resultStep1, resultStep2, tasksResults)
})

/*forkJoin([
    workersEnv.requestWorker().pipe(
        mergeMap( (worker: any) => worker.execute( computeStep1, df) )
    ),
    workersEnv.requestWorker().pipe(
        mergeMap( (worker: any) => worker.execute( computeStep2, df) )
    )
]).subscribe( ([resultStep1, resultStep2]) => {
    console.log(resultStep1, resultStep2)
})*/