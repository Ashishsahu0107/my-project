import { Call } from '../models/Call.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * @desc   Get paginated call history for the authenticated user
 * @route  GET /api/calls/history?page=1&limit=20
 */
export const getCallHistory = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
  const skip = (page - 1) * limit;

  const query = {
    $or: [{ caller: userId }, { callee: userId }]
  };

  const [calls, total] = await Promise.all([
    Call.find(query)
      .populate('caller', 'username avatar')
      .populate('callee', 'username avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Call.countDocuments(query)
  ]);

  res.status(200).json({
    status: 'success',
    results: calls.length,
    data: {
      calls,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total
      }
    }
  });
});

/**
 * @desc   Get call stats for the authenticated user
 * @route  GET /api/calls/stats
 */
export const getCallStats = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const userCallFilter = { $or: [{ caller: userId }, { callee: userId }] };

  const [totalCalls, missedCalls, durationAgg] = await Promise.all([
    Call.countDocuments(userCallFilter),
    Call.countDocuments({ ...userCallFilter, status: 'missed', callee: userId }),
    Call.aggregate([
      { $match: { $or: [{ caller: userId }, { callee: userId }], status: 'ended' } },
      { $group: { _id: null, totalDuration: { $sum: '$duration' } } }
    ])
  ]);

  const totalDuration = durationAgg.length > 0 ? durationAgg[0].totalDuration : 0;

  res.status(200).json({
    status: 'success',
    data: {
      totalCalls,
      missedCalls,
      totalDuration
    }
  });
});
