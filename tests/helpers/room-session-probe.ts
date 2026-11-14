// Run in a separate process so mocks cannot affect real-socket regression tests.
import { mock, expect } from "bun:test";
import { EventEmitter } from "node:events";
class FakeSocket extends EventEmitter {
  connected=true; id="host";
  disconnect(){this.connected=false;super.emit("disconnect");}
}
let connections=0;
const transport=new FakeSocket();
mock.module("socket.io-client",()=>({io:()=>{connections++;return transport;}}));
mock.module("sonner",()=>({toast:{error:()=>{}}}));
const {useGame}=await import("../../src/lib/game-store");
const session=await import("../../src/lib/room-session");
(globalThis as any).window={location:{protocol:"http:",hostname:"localhost",port:"3000",search:""}};
useGame.setState({screen:"playing",roundSerial:0,roomConnect:{kind:"create",config:{password:"secret"} as any}});
let notifications=0;
const unsubscribe=session.subscribeRoom(()=>notifications++);
expect(session.acquireRoomSocket()).toBe(session.acquireRoomSocket());expect(connections).toBe(1);
transport.emit("message",{t:"roomJoined",matchId:"group",mapId:"compound",mode:"tdm",roomName:"Squad"});
expect(useGame.getState().roomConnect).toEqual({kind:"join",roomId:"group",roomName:"Squad",password:"secret"});
useGame.setState({screen:"results",matchResult:{} as any});
transport.emit("message",{t:"roomStatus",status:{phase:"ended",room:{id:"group"}}});
expect(session.getRoomStatus()?.phase).toBe("ended");
const before=useGame.getState().roundSerial;
transport.emit("message",{t:"roundLaunched",roomId:"group",mapId:"skybridge",mode:"tdm",config:{scoreLimit:20,timeLimit:120}});
expect(useGame.getState().screen).toBe("playing");expect(useGame.getState().matchResult).toBeNull();
expect(useGame.getState().playConfig.mapId).toBe("skybridge");expect(useGame.getState().playConfig.timeLimit).toBe(2);
expect(useGame.getState().roundSerial).toBe(before+1);expect(useGame.getState().roomConnect?.password).toBe("secret");
expect(session.acquireRoomSocket()).toBe(transport as any);expect(connections).toBe(1);
session.releaseRoomSession();expect(transport.connected).toBe(false);expect(session.getRoomStatus()).toBeNull();
expect(notifications).toBeGreaterThan(0);unsubscribe();console.log("Room session lifecycle passed");
