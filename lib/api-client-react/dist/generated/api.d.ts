import type { QueryKey, UseMutationOptions, UseMutationResult, UseQueryOptions, UseQueryResult } from '@tanstack/react-query';
import type { AdminLoginInput, AdminToken, Costume, CostumeInput, HealthStatus, ResultsSummary, Session, SessionInput, VoteResult, VoteSubmission, VoterInput, VoterRegistration } from './api.schemas';
import { customFetch } from '../custom-fetch';
import type { ErrorType, BodyType } from '../custom-fetch';
type AwaitedInput<T> = PromiseLike<T> | T;
type Awaited<O> = O extends AwaitedInput<infer T> ? T : never;
type SecondParameter<T extends (...args: never) => unknown> = Parameters<T>[1];
export declare const getHealthCheckUrl: () => string;
/**
 * @summary Health check
 */
export declare const healthCheck: (options?: RequestInit) => Promise<HealthStatus>;
export declare const getHealthCheckQueryKey: () => readonly ["/api/healthz"];
export declare const getHealthCheckQueryOptions: <TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData> & {
    queryKey: QueryKey;
};
export type HealthCheckQueryResult = NonNullable<Awaited<ReturnType<typeof healthCheck>>>;
export type HealthCheckQueryError = ErrorType<unknown>;
/**
 * @summary Health check
 */
export declare function useHealthCheck<TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getGetActiveSessionUrl: () => string;
/**
 * @summary Get the currently active voting session
 */
export declare const getActiveSession: (options?: RequestInit) => Promise<Session>;
export declare const getGetActiveSessionQueryKey: () => readonly ["/api/sessions/active"];
export declare const getGetActiveSessionQueryOptions: <TData = Awaited<ReturnType<typeof getActiveSession>>, TError = ErrorType<void>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getActiveSession>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getActiveSession>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetActiveSessionQueryResult = NonNullable<Awaited<ReturnType<typeof getActiveSession>>>;
export type GetActiveSessionQueryError = ErrorType<void>;
/**
 * @summary Get the currently active voting session
 */
export declare function useGetActiveSession<TData = Awaited<ReturnType<typeof getActiveSession>>, TError = ErrorType<void>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getActiveSession>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getRegisterVoterUrl: () => string;
/**
 * @summary Register as a voter with a nickname
 */
export declare const registerVoter: (voterInput: VoterInput, options?: RequestInit) => Promise<VoterRegistration>;
export declare const getRegisterVoterMutationOptions: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof registerVoter>>, TError, {
        data: BodyType<VoterInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof registerVoter>>, TError, {
    data: BodyType<VoterInput>;
}, TContext>;
export type RegisterVoterMutationResult = NonNullable<Awaited<ReturnType<typeof registerVoter>>>;
export type RegisterVoterMutationBody = BodyType<VoterInput>;
export type RegisterVoterMutationError = ErrorType<void>;
/**
* @summary Register as a voter with a nickname
*/
export declare const useRegisterVoter: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof registerVoter>>, TError, {
        data: BodyType<VoterInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof registerVoter>>, TError, {
    data: BodyType<VoterInput>;
}, TContext>;
export declare const getListCostumesUrl: () => string;
/**
 * @summary List all costumes for the active session
 */
export declare const listCostumes: (options?: RequestInit) => Promise<Costume[]>;
export declare const getListCostumesQueryKey: () => readonly ["/api/costumes"];
export declare const getListCostumesQueryOptions: <TData = Awaited<ReturnType<typeof listCostumes>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listCostumes>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listCostumes>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListCostumesQueryResult = NonNullable<Awaited<ReturnType<typeof listCostumes>>>;
export type ListCostumesQueryError = ErrorType<unknown>;
/**
 * @summary List all costumes for the active session
 */
export declare function useListCostumes<TData = Awaited<ReturnType<typeof listCostumes>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listCostumes>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getSubmitVotesUrl: () => string;
/**
 * @summary Submit votes for costumes
 */
export declare const submitVotes: (voteSubmission: VoteSubmission, options?: RequestInit) => Promise<VoteResult>;
export declare const getSubmitVotesMutationOptions: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof submitVotes>>, TError, {
        data: BodyType<VoteSubmission>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof submitVotes>>, TError, {
    data: BodyType<VoteSubmission>;
}, TContext>;
export type SubmitVotesMutationResult = NonNullable<Awaited<ReturnType<typeof submitVotes>>>;
export type SubmitVotesMutationBody = BodyType<VoteSubmission>;
export type SubmitVotesMutationError = ErrorType<void>;
/**
* @summary Submit votes for costumes
*/
export declare const useSubmitVotes: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof submitVotes>>, TError, {
        data: BodyType<VoteSubmission>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof submitVotes>>, TError, {
    data: BodyType<VoteSubmission>;
}, TContext>;
export declare const getAdminLoginUrl: () => string;
/**
 * @summary Admin login with password
 */
export declare const adminLogin: (adminLoginInput: AdminLoginInput, options?: RequestInit) => Promise<AdminToken>;
export declare const getAdminLoginMutationOptions: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof adminLogin>>, TError, {
        data: BodyType<AdminLoginInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof adminLogin>>, TError, {
    data: BodyType<AdminLoginInput>;
}, TContext>;
export type AdminLoginMutationResult = NonNullable<Awaited<ReturnType<typeof adminLogin>>>;
export type AdminLoginMutationBody = BodyType<AdminLoginInput>;
export type AdminLoginMutationError = ErrorType<void>;
/**
* @summary Admin login with password
*/
export declare const useAdminLogin: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof adminLogin>>, TError, {
        data: BodyType<AdminLoginInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof adminLogin>>, TError, {
    data: BodyType<AdminLoginInput>;
}, TContext>;
export declare const getGetResultsUrl: () => string;
/**
 * @summary Get live exit poll results, top 5 costumes
 */
export declare const getResults: (options?: RequestInit) => Promise<ResultsSummary>;
export declare const getGetResultsQueryKey: () => readonly ["/api/admin/results"];
export declare const getGetResultsQueryOptions: <TData = Awaited<ReturnType<typeof getResults>>, TError = ErrorType<void>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getResults>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getResults>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetResultsQueryResult = NonNullable<Awaited<ReturnType<typeof getResults>>>;
export type GetResultsQueryError = ErrorType<void>;
/**
 * @summary Get live exit poll results, top 5 costumes
 */
export declare function useGetResults<TData = Awaited<ReturnType<typeof getResults>>, TError = ErrorType<void>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getResults>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getCreateSessionUrl: () => string;
/**
 * @summary Create a new voting session
 */
export declare const createSession: (sessionInput: SessionInput, options?: RequestInit) => Promise<Session>;
export declare const getCreateSessionMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createSession>>, TError, {
        data: BodyType<SessionInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createSession>>, TError, {
    data: BodyType<SessionInput>;
}, TContext>;
export type CreateSessionMutationResult = NonNullable<Awaited<ReturnType<typeof createSession>>>;
export type CreateSessionMutationBody = BodyType<SessionInput>;
export type CreateSessionMutationError = ErrorType<unknown>;
/**
* @summary Create a new voting session
*/
export declare const useCreateSession: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createSession>>, TError, {
        data: BodyType<SessionInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createSession>>, TError, {
    data: BodyType<SessionInput>;
}, TContext>;
export declare const getCloseSessionUrl: (id: number) => string;
/**
 * @summary Close the voting session (no more votes accepted)
 */
export declare const closeSession: (id: number, options?: RequestInit) => Promise<Session>;
export declare const getCloseSessionMutationOptions: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof closeSession>>, TError, {
        id: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof closeSession>>, TError, {
    id: number;
}, TContext>;
export type CloseSessionMutationResult = NonNullable<Awaited<ReturnType<typeof closeSession>>>;
export type CloseSessionMutationError = ErrorType<void>;
/**
* @summary Close the voting session (no more votes accepted)
*/
export declare const useCloseSession: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof closeSession>>, TError, {
        id: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof closeSession>>, TError, {
    id: number;
}, TContext>;
export declare const getResetVotesUrl: () => string;
/**
 * @summary Delete all votes and voters for the current session
 */
export declare const resetVotes: (options?: RequestInit) => Promise<void>;
export declare const getResetVotesMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof resetVotes>>, TError, void, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof resetVotes>>, TError, void, TContext>;
export type ResetVotesMutationResult = NonNullable<Awaited<ReturnType<typeof resetVotes>>>;
export type ResetVotesMutationError = ErrorType<unknown>;
/**
* @summary Delete all votes and voters for the current session
*/
export declare const useResetVotes: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof resetVotes>>, TError, void, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof resetVotes>>, TError, void, TContext>;
export declare const getResetCostumesUrl: () => string;
/**
 * @summary Delete all costumes (and votes) for the current session
 */
export declare const resetCostumes: (options?: RequestInit) => Promise<void>;
export declare const getResetCostumesMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof resetCostumes>>, TError, void, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof resetCostumes>>, TError, void, TContext>;
export type ResetCostumesMutationResult = NonNullable<Awaited<ReturnType<typeof resetCostumes>>>;
export type ResetCostumesMutationError = ErrorType<unknown>;
/**
* @summary Delete all costumes (and votes) for the current session
*/
export declare const useResetCostumes: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof resetCostumes>>, TError, void, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof resetCostumes>>, TError, void, TContext>;
export declare const getListAdminCostumesUrl: () => string;
/**
 * @summary List all costumes (admin view, with full stats)
 */
export declare const listAdminCostumes: (options?: RequestInit) => Promise<Costume[]>;
export declare const getListAdminCostumesQueryKey: () => readonly ["/api/admin/costumes"];
export declare const getListAdminCostumesQueryOptions: <TData = Awaited<ReturnType<typeof listAdminCostumes>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listAdminCostumes>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listAdminCostumes>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListAdminCostumesQueryResult = NonNullable<Awaited<ReturnType<typeof listAdminCostumes>>>;
export type ListAdminCostumesQueryError = ErrorType<unknown>;
/**
 * @summary List all costumes (admin view, with full stats)
 */
export declare function useListAdminCostumes<TData = Awaited<ReturnType<typeof listAdminCostumes>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listAdminCostumes>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getCreateCostumeUrl: () => string;
/**
 * @summary Add a costume to the active session
 */
export declare const createCostume: (costumeInput: CostumeInput, options?: RequestInit) => Promise<Costume>;
export declare const getCreateCostumeMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createCostume>>, TError, {
        data: BodyType<CostumeInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createCostume>>, TError, {
    data: BodyType<CostumeInput>;
}, TContext>;
export type CreateCostumeMutationResult = NonNullable<Awaited<ReturnType<typeof createCostume>>>;
export type CreateCostumeMutationBody = BodyType<CostumeInput>;
export type CreateCostumeMutationError = ErrorType<unknown>;
/**
* @summary Add a costume to the active session
*/
export declare const useCreateCostume: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createCostume>>, TError, {
        data: BodyType<CostumeInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createCostume>>, TError, {
    data: BodyType<CostumeInput>;
}, TContext>;
export declare const getDeleteCostumeUrl: (id: number) => string;
/**
 * @summary Remove a costume
 */
export declare const deleteCostume: (id: number, options?: RequestInit) => Promise<void>;
export declare const getDeleteCostumeMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteCostume>>, TError, {
        id: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof deleteCostume>>, TError, {
    id: number;
}, TContext>;
export type DeleteCostumeMutationResult = NonNullable<Awaited<ReturnType<typeof deleteCostume>>>;
export type DeleteCostumeMutationError = ErrorType<unknown>;
/**
* @summary Remove a costume
*/
export declare const useDeleteCostume: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteCostume>>, TError, {
        id: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof deleteCostume>>, TError, {
    id: number;
}, TContext>;
export {};
//# sourceMappingURL=api.d.ts.map