import {GroupIDStr} from '../db/Groups';
import {JSONRPC} from './JSONRPC';

export class GroupLeaves {

    public static async exec(request: GroupLeaveRequest): Promise<void> {
        return await JSONRPC.exec('groupLeave', request);
    }

}

export interface GroupLeaveRequest {

    readonly groupID: GroupIDStr;

}
