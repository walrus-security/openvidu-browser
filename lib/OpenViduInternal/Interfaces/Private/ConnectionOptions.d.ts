import { StreamOptionsServer } from './StreamOptionsServer';
export interface ConnectionOptions {
    id: string;
    createdAt: number;
    metadata: string;
    streams: StreamOptionsServer[];
}
