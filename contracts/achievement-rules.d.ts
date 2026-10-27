import type {AchievementProjection,AchievementState,EarnedAchievement,GameplayEvent,EventValue} from './achievements.js';
export type FieldSchema = {type:'string';maxLength:number;optional?:boolean;enum?:string[]} | {type:'number';min?:number;max?:number;optional?:boolean;enum?:number[]} | {type:'boolean';optional?:boolean;enum?:boolean[]};
export interface EventPredicate { field:string; op:'eq'|'ne'|'gt'|'gte'|'lt'|'lte'; value:EventValue; }
export type Statistic = {id:string;event:string;where?:EventPredicate[]} & ({op:'count'}|{op:'sum'|'min'|'max';field:string}|{op:'distinct';field:string;limit?:number});
export type AchievementCondition = {stat:string;op:'eq'|'gt'|'gte'|'lt'|'lte';value:number} | {all:AchievementCondition[]} | {any:AchievementCondition[]};
export interface AchievementDefinition { id:string;title:string;description:string;secret?:boolean;points:number;xp:number;condition:AchievementCondition;icon?:string;iconAlt?:string; }
export interface AchievementManifest { schemaVersion:1;setId:string;title:string;description:string;earningScope:string;events:Record<string,{fields:Record<string,FieldSchema>}>;stats:Statistic[];achievements:AchievementDefinition[];levels:Array<{level:number;xp:number}>;xpRules?:Array<{id:string;event:string;xp:number;limit:number;where?:EventPredicate[]}>; }
export interface ValidationIssue { path:string;message:string; }
export type ManifestValidation = {valid:true;errors:ValidationIssue[];warnings:ValidationIssue[];manifest:AchievementManifest} | {valid:false;errors:ValidationIssue[];warnings:ValidationIssue[];manifest?:never};
export interface EvaluationTrace { kind:'stat'|'achievement'|'xp';id:string;reason:string;before?:number;after?:number;points?:number;xp?:number;eventId?:string; }
export interface EventEvaluation { state:AchievementState;awards:EarnedAchievement[];xpDelta:number;trace:EvaluationTrace[];completion:boolean; }
export type SimulationReceipt = {eventId:string;status:'accepted';awards:EarnedAchievement[];xpDelta:number;completion:boolean;replayed?:boolean} | {eventId?:string;status:'rejected';code:string;error:string};
export interface Simulation { valid:boolean;errors:ValidationIssue[];warnings:ValidationIssue[];state:AchievementState;receipts:SimulationReceipt[];trace:EvaluationTrace[]; }
export declare function canonicalManifest(value:unknown):string;
export declare function validateManifest(input:unknown):ManifestValidation;
export declare function initialProgress():AchievementState;
export declare function validateEvent(manifest:AchievementManifest,event:GameplayEvent):GameplayEvent;
export declare function evaluateEvent(manifest:AchievementManifest,previous:AchievementState|null|undefined,event:GameplayEvent):EventEvaluation;
export declare function simulate(manifest:unknown,events:GameplayEvent[],initialState?:AchievementState):Simulation;
export declare function diffManifests(previous:AchievementManifest|null|undefined,next:unknown):{changed:boolean;breaking:boolean;changes:Array<{path:string;kind:'invalid'|'created'|'changed'}>;errors?:ValidationIssue[]};
export declare function projectProgress(manifest:AchievementManifest,state?:AchievementState|null,options?:{publicView?:boolean}):AchievementProjection;
