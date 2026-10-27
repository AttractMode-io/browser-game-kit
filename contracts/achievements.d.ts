/** Shared/browser contracts. These do not supply React Native authentication. */
export type Provenance = 'personal' | 'publisher_validated';
export type EventValue = string | number | boolean;
export interface GameplayEvent { eventId:string; occurrenceId:string; buildId:string; type:string; occurredAt?:string; payload:Record<string,EventValue>; }
/** Server transport requires the timestamp persisted with the original event. */
export interface RuntimeGameplayEvent extends GameplayEvent { occurredAt:string; }
export interface EarnedAchievement { achievementId:string; earningScope:string; title:string; description:string; points:number; xp:number; revoked?:boolean; }
export interface AchievementState { stats:Record<string,number|string[]>; earned:Record<string,EarnedAchievement>; xp:number; xpCounts:Record<string,number>; completion:boolean; level?:number; }
export interface AchievementReceipt { accepted:true; receiptId:string; eventId:string; releaseId:string; provenance:Provenance; duplicate:boolean; state:AchievementState; awards:EarnedAchievement[]; xpDelta:number; }
export type SyncResult = {status:'accepted';eventId:string;setId:string;receipt:AchievementReceipt} | {status:'pending';eventId:string;setId:string;code?:string} | {status:'rejected';eventId:string;setId:string;code:string;statusCode?:number};
export type AchievementNotification = SyncResult | {status:'account_changed'|'cleared'};
export interface AchievementProjection { setId:string; title:string; description:string; earningScope:string; xp:number; level:number; completion:boolean; provenance?:Provenance; releaseId?:string; achievements:Array<{id:string;title:string;description:string;secret?:boolean;earned:boolean;points?:number;xp?:number;icon?:string;iconAlt?:string}>; }
export interface AchievementProgress { projections:AchievementProjection[]; }
export interface ProfileLink { token:string; expiresAt:string; projectId:string; gameId:string; environment:string; }
export interface GameSessionScope { gameId:string; environment:string; playerId:string; }
export interface QueueStorage { getItem(key:string):string|null; setItem(key:string,value:string):void; removeItem(key:string):void; }
export interface AchievementClient { readonly persistence:'memory'|'durable'; report(input:{setId:string;event:GameplayEvent}):Promise<SyncResult>; getProgress(input?:{setId:string;mode?:Provenance}):Promise<AchievementProgress>; startProfileLink():Promise<ProfileLink & {consentUrl:string}>; flush():Promise<SyncResult[]>; pending():Array<{setId:string;eventId:string;queuedAt:number}>; clearQueue():void; setScope(scope:string|null):void; subscribe(listener:(event:AchievementNotification)=>void):()=>void; dispose():void; }
export interface AchievementOptions { endpoint?:string; fetch?:typeof fetch; storage?:QueueStorage; scope?:string|null; maxQueue?:number; maxAgeMs?:number; now?:()=>number; timeoutMs?:number; }
export declare class AchievementError extends Error { constructor(code:string,message:string,status?:number); code:string; status:number; }
export declare function createAchievementClient(options?:AchievementOptions):AchievementClient;
export declare function createAchievementScope(account:GameSessionScope):string;
