from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response


class StandardResultsPagination(PageNumberPagination):
    """
    Shared pagination for Admin list endpoints (Academic Managers,
    Faculty, Students, Courses, Leave Requests).

    Query params: ?page=<n>&limit=<per_page>  (default limit: 10)

    Deliberately NOT set as DRF's global DEFAULT_PAGINATION_CLASS —
    that would silently paginate every other list endpoint in the
    project too (Attendance, Exam Marks, Assignments, Learning
    Materials, Submissions, Faculty Leave History, Student Leave
    Requests...), breaking every frontend file that currently expects
    response.data to be a plain array. This pagination class is
    applied individually, only to the 5 views in scope for this task.
    """
    page_size = 10
    page_size_query_param = "limit"
    page_query_param = "page"
    max_page_size = 100

    def get_paginated_response(self, data):
        return Response({
            "count": self.page.paginator.count,
            "total_pages": self.page.paginator.num_pages,
            "current_page": self.page.number,
            "page_size": self.get_page_size(self.request),
            "next": self.get_next_link(),
            "previous": self.get_previous_link(),
            "results": data,
        })