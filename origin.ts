import {OpineRequest} from './deps.ts'

export const origin = (req: OpineRequest) => 
    `http${req.get('host')?.match(/^localhost:/) ? '' : 's'}://${req.get('host')}`