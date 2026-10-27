import type {AchievementReceipt,AchievementProgress,GameSessionScope,ProfileLink,Provenance,RuntimeGameplayEvent} from './achievements.js';
export type RuntimeRequest = {playerId:string} & ({action:'event.report'|'event.submit';data:{setId:string;event:RuntimeGameplayEvent}} | {action:'progress.get';data:{setId:string;mode?:Provenance}} | {action:'binding.link.start';data:Record<string,never>});
export type RuntimeResponse = AchievementReceipt | AchievementProgress | ProfileLink;
export interface AchievementTransport {
 (request:Extract<RuntimeRequest,{action:'event.report'|'event.submit'}>):Promise<AchievementReceipt>;
 (request:Extract<RuntimeRequest,{action:'progress.get'}>):Promise<AchievementProgress>;
 (request:Extract<RuntimeRequest,{action:'binding.link.start'}>):Promise<ProfileLink>;
 (request:RuntimeRequest):Promise<RuntimeResponse>;
}
export declare function createAchievementTransport(options:{endpoint:string;credential:string;enabled?:boolean;fetch?:typeof fetch}):AchievementTransport;
export declare function createAchievementBridge(options:{origin:string;resolveSession:(request:Request)=>GameSessionScope|null|undefined|Promise<GameSessionScope|null|undefined>;execute:(request:RuntimeRequest)=>RuntimeResponse|Promise<RuntimeResponse>}):(request:Request)=>Promise<Response>;
